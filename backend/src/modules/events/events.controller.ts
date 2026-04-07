import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';
import { getOrSetCache } from '../../utils/redis.js';
import redis from '../../utils/redis.js';
import { catchAsync, AppError } from '../../utils/errors.js';

export const getEvents = catchAsync(async (req: Request, res: Response) => {
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
    } else if (user.role === 'DEPARTMENT_LEADER' || user.role === 'PASTOR' || user.role === 'ASSOCIATE_PASTOR') {
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
});

export const getEventsByDepartment = catchAsync(async (req: Request, res: Response) => {
    const events = await prisma.event.findMany({
        where: { departmentId: req.params.departmentId },
        include: { department: true },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });
    res.json(events);
});

export const createEvent = catchAsync(async (req: any, res: Response) => {
    const { title, description, date, time, location, eventType, budgetNeeded, volunteersNeeded, departmentId, pastorIds, attachmentUrl } = req.body;
    
    const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(req.user?.role);
    const targetDeptId = departmentId || req.user?.departmentId;
    const isManaging = req.user?.managedDepartments?.some((d: any) => d.id === targetDeptId) || req.user?.departmentId === targetDeptId;
    
    if (!isExecutive && req.user?.role === 'DEPARTMENT_LEADER' && !isManaging) {
        throw new AppError('Leaders can only create events for their own department', 403);
    }

    const eventDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (eventDate < today) {
        throw new AppError('Events cannot be scheduled for past dates.', 400);
    }

    const conflict = await prisma.event.findFirst({
        where: {
            date: new Date(date),
            location,
            approvalStatus: { not: 'REJECTED' }
        }
    });

    if (conflict) {
        throw new AppError(`TACTICAL CONFLICT: The venue "${location}" is already reserved on ${new Date(date).toLocaleDateString()}.`, 409);
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
});

export const approveEvent = catchAsync(async (req: any, res: Response) => {
    const { id } = req.params;
    const user = req.user!;

    const event = await prisma.event.findUnique({ 
        where: { id },
        include: { department: true }
    });
    
    if (!event) throw new AppError('Event not found', 404);

    const existing = await prisma.eventApproval.findUnique({
        where: { eventId_userId: { eventId: id, userId: user.id } }
    });
    
    if (existing) throw new AppError('You have already approved this event.', 400);

    const totalApprovals = await prisma.$transaction(async (tx) => {
        await tx.eventApproval.create({
            data: {
                eventId: id,
                userId: user.id,
                role: user.role === 'SUPER_ADMIN' ? 'BISHOP' : (['PASTOR', 'ASSOCIATE_PASTOR'].includes(user.role) ? 'PASTOR' : user.role)
            }
        });

        const allApprovals = await tx.eventApproval.findMany({ where: { eventId: id } });
        const bishopApproved = allApprovals.some((a: any) => a.role === 'BISHOP');
        const pastorCount = allApprovals.filter((a: any) => a.role === 'PASTOR').length;

        const quorumMet = bishopApproved && pastorCount >= 2;

        if (quorumMet) {
            await tx.event.update({
                where: { id },
                data: { approvalStatus: 'APPROVED' }
            });
        }
        return allApprovals.length;
    });

    // Handle outside transaction
    if (totalApprovals >= 2) { // Logic from before, if quorum is actually met (approximate check based on past)
        const checkEvent = await prisma.event.findUnique({ where: {id} });
        if(checkEvent?.approvalStatus === 'APPROVED') {
            await logAudit(user.id, 'PUBLISH', 'EVENT', id, { title: event.title });
            // Invalidate Event Cache
            const keys = await redis.keys('events:*');
            if (keys.length > 0) await redis.del(...keys);
        }
    }

    res.json({ message: 'Approval recorded.', totalApprovals });
});

export const updateEvent = catchAsync(async (req: any, res: Response) => {
    const { id, departmentId, approvalStatus, createdAt, date, budgetNeeded, volunteersNeeded, attachmentUrl, localVersion, isOfflineSync, ...rest } = req.body;
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    
    if (!event) throw new AppError('Event not found', 404);

    // OCC: Offline Sync Conflict Arbitration
    if (isOfflineSync && localVersion !== undefined && event.version !== localVersion) {
        // Return 409 Conflict with the current authoritative server state
        return res.status(409).json(event);
    }

    const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(req.user.role);
    const isManaging = req.user.managedDepartments?.some((d: any) => d.id === event.departmentId) || req.user.departmentId === event.departmentId;
    const canUpdate = isExecutive || (req.user.role === 'DEPARTMENT_LEADER' && isManaging);
    
    if (!canUpdate) {
        throw new AppError('Access denied: Executive or Sector permission required', 403);
    }

    if (event.approvalStatus === 'APPROVED' && req.user.role !== 'SUPER_ADMIN') {
        throw new AppError('Approved events are locked and cannot be modified.', 403);
    }

    const updatedEvent = await prisma.event.update({
        where: { id: req.params.id },
        data: {
            ...rest,
            version: { increment: 1 }, // Atomically increment version for OCC
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
});

export const deleteEvent = catchAsync(async (req: any, res: Response) => {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) throw new AppError('Event not found', 404);

    if (req.user.role === 'SECRETARY') {
        throw new AppError('Secretaries cannot delete church records', 403);
    }

    const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(req.user.role);
    const isManaging = req.user.managedDepartments?.some((d: any) => d.id === event.departmentId) || req.user.departmentId === event.departmentId;
    const canDelete = isExecutive || (req.user.role === 'DEPARTMENT_LEADER' && isManaging);
    
    if (!canDelete) {
        throw new AppError('Access denied: Executive or Sector priority required', 403);
    }

    if (event.approvalStatus === 'APPROVED' && req.user.role !== 'SUPER_ADMIN') {
        throw new AppError('Approved events are locked and cannot be deleted.', 403);
    }

    await prisma.$transaction(async (tx) => {
        await tx.event.update({
            where: { id: req.params.id },
            data: { deletedAt: new Date() }
        });
        
        // Remove related hard-delete records
        await tx.eventApproval.deleteMany({ where: { eventId: req.params.id } });
    });

    await logAudit(req.user.id, 'DELETE', 'EVENT', event.id, { title: event.title });

    // Invalidate Event Cache
    const keys = await redis.keys('events:*');
    if (keys.length > 0) await redis.del(...keys);

    res.json({ message: 'Event deleted successfully' });
});
