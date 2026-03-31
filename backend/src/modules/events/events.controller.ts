import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';
import { getOrSetCache } from '../../utils/redis.js';
import redis from '../../utils/redis.js';

export const getEvents = async (req: Request, res: Response) => {
    try {
        const { departmentId, isMajor, page = '1', limit = '10' } = req.query;
        const user = (req as any).user;
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        const where: any = {};
        if (departmentId) where.departmentId = String(departmentId);
        if (isMajor !== undefined) where.isMajor = isMajor === 'true';

        if (user.role === 'WATUA') {
            // Sees all
        } else if (isMajor === 'true') {
            where.approvalStatus = 'APPROVED';
            where.isMajor = true;
        } else if (user.role === 'MEMBER') {
            where.approvalStatus = 'APPROVED';
            where.OR = [
                { isMajor: true },
                ...(user.departmentId ? [{ departmentId: user.departmentId }] : [])
            ];
        } else if (user.role === 'DEPARTMENT_LEADER' || user.role === 'PASTOR') {
            const managedDeptIds = user.managedDepartments?.map((d: any) => d.id) || [];
            if (user.departmentId) managedDeptIds.push(user.departmentId);

            if (!departmentId) {
                where.OR = [
                    { departmentId: { in: managedDeptIds } },
                    { approvalStatus: 'APPROVED', isMajor: true }
                ];
            } else {
                if (!managedDeptIds.includes(String(departmentId))) {
                    where.approvalStatus = 'APPROVED';
                }
                where.departmentId = String(departmentId);
            }
        }

        const cacheKey = `events:${user.role}:${user.departmentId || 'none'}:${departmentId || 'all'}:${isMajor || 'any'}:${page}:${limit}`;

        const result = await getOrSetCache(cacheKey, async () => {
            const [data, total] = await Promise.all([
                prisma.event.findMany({
                    where,
                    include: { department: true },
                    orderBy: [{ date: 'asc' }, { time: 'asc' }],
                    skip,
                    take,
                }),
                prisma.event.count({ where })
            ]);
            return { data, total };
        }, 120);

        res.json({
            data: result.data,
            meta: {
                total: result.total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(result.total / Number(limit))
            }
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch events' });
    }
};

export const getEventsByDepartment = async (req: Request, res: Response) => {
    try {
        const events = await prisma.event.findMany({
            where: { departmentId: req.params.departmentId },
            include: { department: true },
            orderBy: [{ date: 'asc' }, { time: 'asc' }],
        });
        res.json(events);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch events' });
    }
};

export const createEvent = async (req: any, res: Response) => {
    const { title, description, date, time, location, eventType, budgetNeeded, volunteersNeeded, departmentId, pastorIds, attachmentUrl } = req.body;
    
    const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(req.user?.role);
    const targetDeptId = departmentId || req.user?.departmentId;
    const isManaging = req.user?.managedDepartments?.some((d: any) => d.id === targetDeptId) || req.user?.departmentId === targetDeptId;
    
    if (!isExecutive && req.user?.role === 'DEPARTMENT_LEADER' && !isManaging) {
        return res.status(403).json({ error: 'Leaders can only create events for their own department' });
    }
    
    if (req.user?.role === 'MEMBER') {
        return res.status(403).json({ error: 'Members cannot create tactical missions' });
    }

    if (!pastorIds || !Array.isArray(pastorIds) || pastorIds.length !== 2) {
        return res.status(400).json({ error: 'You must select exactly 2 Pastors to approve this event.' });
    }

    const eventDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (eventDate < today) {
        return res.status(400).json({ error: 'Events cannot be scheduled for past dates.' });
    }

    try {
        const conflict = await prisma.event.findFirst({
            where: {
                date: new Date(date),
                location,
                approvalStatus: { not: 'REJECTED' }
            }
        });
        if (conflict) {
            return res.status(409).json({ 
                error: `TACTICAL CONFLICT: The venue "${location}" is already reserved on ${new Date(date).toLocaleDateString()}.` 
            });
        }

        const event = await prisma.event.create({
            data: {
                title, description, location, eventType, 
                departmentId: targetDeptId,
                date: new Date(date), time,
                budgetNeeded: Number(budgetNeeded) || 0,
                volunteersNeeded: Number(volunteersNeeded) || 0,
                attachmentUrl,
                isMajor: req.body.isMajor === true,
                approvalStatus: 'PENDING_APPROVAL',
            },
        });

        await logAudit(req.user.id, 'CREATE', 'EVENT', event.id, { title, location });

        // Invalidate Event Cache
        const keys = await redis.keys('events:*');
        if (keys.length > 0) await redis.del(...keys);

        res.status(201).json(event);
    } catch (error: any) {
        console.error('[createEvent]', error);
        res.status(400).json({ error: error.message || 'Failed to create event' });
    }
};

export const approveEvent = async (req: any, res: Response) => {
    const { id } = req.params;
    const user = req.user!;

    if (!['SUPER_ADMIN', 'PASTOR', 'WATUA'].includes(user.role)) {
        return res.status(403).json({ error: 'Only the Bishop or Pastors can approve events.' });
    }

    try {
        const event = await prisma.event.findUnique({ 
            where: { id },
            include: { department: true }
        });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const existing = await prisma.eventApproval.findUnique({
            where: { eventId_userId: { eventId: id, userId: user.id } }
        });
        if (existing) return res.status(400).json({ error: 'You have already approved this event.' });

        await prisma.eventApproval.create({
            data: {
                eventId: id,
                userId: user.id,
                role: user.role === 'SUPER_ADMIN' ? 'BISHOP' : 'PASTOR'
            }
        });

        const allApprovals = await prisma.eventApproval.findMany({ where: { eventId: id } });
        const bishopApproved = allApprovals.some((a: any) => a.role === 'BISHOP');
        const pastorCount = allApprovals.filter((a: any) => a.role === 'PASTOR').length;

        const quorumMet = bishopApproved && pastorCount >= 2;

        if (quorumMet) {
            await prisma.event.update({
                where: { id },
                data: { approvalStatus: 'APPROVED' }
            });

            await logAudit(user.id, 'PUBLISH', 'EVENT', id, { title: event.title });

            // Invalidate Event Cache
            const keys = await redis.keys('events:*');
            if (keys.length > 0) await redis.del(...keys);
        }

        res.json({ message: 'Approval recorded.', totalApprovals: allApprovals.length });
    } catch (error: any) {
        console.error('[approveEvent]', error);
        res.status(400).json({ error: error.message || 'Failed to approve event' });
    }
};

export const updateEvent = async (req: any, res: Response) => {
    try {
        const { id, departmentId, approvalStatus, createdAt, date, budgetNeeded, volunteersNeeded, attachmentUrl, ...rest } = req.body;
        const event = await prisma.event.findUnique({ where: { id: req.params.id } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(req.user.role);
        const isManaging = req.user.managedDepartments?.some((d: any) => d.id === event.departmentId) || req.user.departmentId === event.departmentId;
        const canUpdate = isExecutive || (req.user.role === 'DEPARTMENT_LEADER' && isManaging);
        
        if (!canUpdate) {
            return res.status(403).json({ error: 'Access denied: Executive or Sector permission required' });
        }

        const updatedEvent = await prisma.event.update({
            where: { id: req.params.id },
            data: {
                ...rest,
                ...(date && { date: new Date(date) }),
                ...(budgetNeeded !== undefined && { budgetNeeded: Number(budgetNeeded) }),
                ...(volunteersNeeded !== undefined && { volunteersNeeded: Number(volunteersNeeded) }),
                ...(attachmentUrl !== undefined && { attachmentUrl }),
            },
        });

        await logAudit(req.user.id, 'UPDATE', 'EVENT', updatedEvent.id, rest);

        // Invalidate Event Cache
        const keys = await redis.keys('events:*');
        if (keys.length > 0) await redis.del(...keys);

        res.json(updatedEvent);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to update event' });
    }
};

export const deleteEvent = async (req: any, res: Response) => {
    try {
        const event = await prisma.event.findUnique({ where: { id: req.params.id } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        if (req.user.role === 'SECRETARY') {
            return res.status(403).json({ error: 'Secretaries cannot delete church records' });
        }

        const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(req.user.role);
        const isManaging = req.user.managedDepartments?.some((d: any) => d.id === event.departmentId) || req.user.departmentId === event.departmentId;
        const canDelete = isExecutive || (req.user.role === 'DEPARTMENT_LEADER' && isManaging);
        
        if (!canDelete) {
            return res.status(403).json({ error: 'Access denied: Executive or Sector priority required' });
        }

        await logAudit(req.user.id, 'DELETE', 'EVENT', event.id, { title: event.title });
        await prisma.event.delete({ where: { id: req.params.id } });

        // Invalidate Event Cache
        const keys = await redis.keys('events:*');
        if (keys.length > 0) await redis.del(...keys);

        res.json({ message: 'Event deleted successfully' });
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to delete event' });
    }
};
