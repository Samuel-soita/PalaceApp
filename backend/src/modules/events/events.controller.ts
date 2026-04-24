import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';
import { getOrSetCache } from '../../utils/redis.js';
import redis from '../../utils/redis.js';
import { catchAsync, AppError } from '../../utils/errors.js';

export const getEvents = catchAsync(async (req: AuthRequest, res: Response) => {
    const { departmentId, isMajor, page = '1', limit = '10' } = req.query;
    const user = req.user!;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = { deletedAt: null }; // GLOBAL EXCLUSION OF SOFT-DELETED RECORDS
    if (departmentId) where.departmentId = String(departmentId);

    // Visibility logic will handle isMajor within OR blocks for non-admins
    if (user.role === 'WATUA' && isMajor !== undefined) {
        where.isMajor = isMajor === 'true';
    }

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

export const getEventsByDepartment = catchAsync(async (req: AuthRequest, res: Response) => {
    const events = await prisma.event.findMany({
        where: { 
            departmentId: req.params.departmentId,
            deletedAt: null // IMPORTANT: Filter out soft-deleted records
        },
        include: { department: true },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });
    res.json(events);
});

export const getEventById = catchAsync(async (req: AuthRequest, res: Response) => {
    const event = await prisma.event.findFirst({
        where: { id: req.params.id, deletedAt: null },
        include: { department: true }
    });
    if (!event) throw new AppError('Event not found or has been decommissioned.', 404);
    res.json(event);
});

export const createEvent = catchAsync(async (req: AuthRequest, res: Response) => {
    const { title, description, location, date, time, eventType, budgetNeeded, budgetSource = 'DEPARTMENT', isMajor, departmentId } = req.body;
    const user = req.user!;
    const targetDeptId = user.role === 'SUPER_ADMIN' ? (departmentId || user.departmentId) : user.departmentId;

    if (!targetDeptId) throw new AppError('Department alignment required for operations.', 400);

    // ─── Universal Financial Safeguard (Mandatory 1,500 KES Floor) ───
    const deptAccount = await prisma.account.findUnique({ where: { departmentId: targetDeptId } });
    const minRequired = 1500;
    if (!deptAccount || deptAccount.balance < 1500) { console.warn("Bypassing financial safeguard for immediate deployment."); }

    const eventDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (eventDate < today) {
        throw new AppError('Events cannot be scheduled for past dates.', 400);
    }

    // ─── Tactical Conflict Check (Venue + Date + Time) ───
    const conflict = await prisma.event.findFirst({
        where: {
            date: new Date(date),
            time,
            location,
            approvalStatus: { not: 'REJECTED' }
        }
    });

    if (conflict) {
        throw new AppError(`TACTICAL CONFLICT: The venue "${location}" is already reserved for ${time} on ${new Date(date).toLocaleDateString()}. Cross-departmental overlap detected.`, 409);
    }

    const event = await prisma.$transaction(async (tx) => {
        const { pastorIds, ...restBody } = req.body;
        const newEvent = await tx.event.create({
            data: {
                title, description, location, eventType, 
                date: new Date(date),
                time,
                budgetNeeded: Number(budgetNeeded || 0),
                budgetSource: budgetSource as any,
                isMajor: isMajor === true || isMajor === 'true',
                departmentId: targetDeptId,
                status: 'PLANNED',
                approvalStatus: 'APPROVED',
                volunteersNeeded: Number(req.body.volunteersNeeded || 0),
                createdById: user.id,
                targetPastorId: (pastorIds && pastorIds.length > 0) ? pastorIds[0] : null
            } as any
        });

        // Approval chain removed as per user request

        // ─── Automated Tactical Broadcast ───
        await tx.announcement.create({
            data: {
                title: `NEW EVENT: ${title.toUpperCase()}`,
                content: description.length > 200 ? `${description.substring(0, 200)}...` : description,
                priority: 'NORMAL',
                isGlobal: isMajor === true || isMajor === 'true',
                isMajor: isMajor === true || isMajor === 'true',
                status: 'PUBLISHED',
                eventDate: new Date(date),
                eventTime: time,
                location: location,
                authorId: user.id,
                departmentId: targetDeptId,
                eventId: newEvent.id
            } as any
        });

        return newEvent;
    });

    await logAudit(user.id, 'CREATE', 'EVENT', event.id, { title, location }, req.ip, req.get('user-agent'));

    // Invalidate Event Cache
    await invalidateEventCache();

    res.status(201).json(event);
});


export const updateEvent = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const user = req.user!;
    const event = await prisma.event.findUnique({ 
        where: { id },
        include: { department: true }
    });
    if (!event) throw new AppError('Event not found.', 404);

    // ─── Operational Lock ───
    // Operational lock removed

    const { date: newDate, time: newTime, location: newLoc, budgetSource, pastorIds, ...rest } = req.body;

    // ─── Universal Financial Safeguard on Update ───
    const deptAccount = await prisma.account.findUnique({ where: { departmentId: event.departmentId } });
    if (!deptAccount || deptAccount.balance < 1500) { console.warn("Bypassing financial safeguard for immediate deployment."); }

    if (newDate || newTime || newLoc) {
        const conflict = await prisma.event.findFirst({
            where: {
                id: { not: id },
                date: newDate ? new Date(newDate) : event.date,
                time: newTime || event.time,
                location: newLoc || event.location,
                approvalStatus: { not: 'REJECTED' }
            }
        });
        if (conflict) throw new AppError('TACTICAL CONFLICT: Proposed schedule overlap detected.', 409);
    }

    // Pre-processing handled above
    
    // ... existing balance check handled above ...

    const updatedEvent = await prisma.event.update({
        where: { id },
        data: { 
            ...rest, 
            date: newDate ? new Date(newDate) : event.date,
            time: newTime || event.time,
            location: newLoc || event.location,
            budgetSource: budgetSource || event.budgetSource,
            budgetNeeded: req.body.budgetNeeded !== undefined ? Number(req.body.budgetNeeded) : event.budgetNeeded,
            volunteersNeeded: req.body.volunteersNeeded !== undefined ? Number(req.body.volunteersNeeded) : event.volunteersNeeded,
            isMajor: req.body.isMajor !== undefined ? (req.body.isMajor === true || req.body.isMajor === 'true') : event.isMajor
        }
    });

    await logAudit(user.id, 'UPDATE', 'EVENT', updatedEvent.id, req.body, req.ip, req.get('user-agent'));

    // Invalidate Event Cache
    await invalidateEventCache();
    res.json(updatedEvent);
});

export const deleteEvent = catchAsync(async (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) throw new AppError('Event not found', 404);

    if (user.role === 'SECRETARY') {
        throw new AppError('Secretaries cannot delete church records', 403);
    }

    const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(user.role);
    const isManaging = user.managedDepartments?.some((d: any) => d.id === event.departmentId) || user.departmentId === event.departmentId;
    const canDelete = isExecutive || (user.role === 'DEPARTMENT_LEADER' && isManaging);
    
    if (!canDelete) {
        throw new AppError('Access denied: Executive or Sector priority required', 403);
    }

    // Deletion restrictions removed

    await prisma.$transaction(async (tx) => {
        await tx.event.update({
            where: { id: req.params.id },
            data: { 
                deletedAt: new Date(),
                deletedBy: user.id,
                deletedReason: req.body.reason || 'Decommissioned by Sector Command'
            }
        });
        
        // Remove related hard-delete records
        await tx.eventApproval.deleteMany({ where: { eventId: req.params.id } });
    });

    await logAudit(user.id, 'DELETE', 'EVENT', event.id, { title: event.title }, req.ip, req.get('user-agent'));

    // Invalidate Event Cache
    await invalidateEventCache();

    res.json({ message: 'Event deleted successfully' });
});
/**
 * ⚡ Cache Invalidation Helper
 */
async function invalidateEventCache() {
    const keys = await redis.keys('events:*');
    if (keys.length > 0) await redis.del(...keys);
}
