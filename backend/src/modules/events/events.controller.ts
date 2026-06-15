import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';
import { getOrSetCache } from '../../utils/redis.js';
import redis from '../../utils/redis.js';
import { catchAsync, AppError } from '../../utils/errors.js';
import { isGlobalOperator, resolveTargetDepartmentId } from '../../utils/department-accounts.js';
import { canAutoPublishContent } from '../../utils/approval-utils.js';

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
    const targetDeptId = resolveTargetDepartmentId(user.role, user.departmentId, departmentId);

    if (!targetDeptId) throw new AppError('Department alignment required for operations.', 400);

    // ─── Universal Financial Safeguard (Mandatory 1,500 KES Floor) ───
    if (!isGlobalOperator(user.role)) {
        const deptAccount = await prisma.account.findUnique({ where: { departmentId: targetDeptId } });
        const minRequired = 1500;
        if (!deptAccount || deptAccount.balance < minRequired) {
            throw new AppError(`INSUFFICIENT SECTORAL LIQUIDITY: A minimum departmental reserve of ${minRequired} KES is required for all operations (Department or Church funded). Current balance: ${deptAccount?.balance || 0} KES.`, 402);
        }
    }

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

    const autoApprove = canAutoPublishContent(user.role);

    const event = await prisma.$transaction(async (tx) => {
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
                approvalStatus: autoApprove ? 'APPROVED' : 'PENDING_APPROVAL',
                volunteersNeeded: Number(req.body.volunteersNeeded || 0)
            } as any
        });

        await tx.announcement.create({
            data: {
                title: `NEW EVENT: ${title.toUpperCase()}`,
                content: description.length > 200 ? `${description.substring(0, 200)}...` : description,
                priority: 'NORMAL',
                isGlobal: isMajor === true || isMajor === 'true',
                isMajor: isMajor === true || isMajor === 'true',
                status: autoApprove ? 'PUBLISHED' : 'PENDING',
                eventDate: new Date(date),
                eventTime: time,
                location: location,
                authorId: user.id,
                departmentId: targetDeptId
            } as any
        });

        return newEvent;
    });

    await logAudit(user.id, 'CREATE', 'EVENT', event.id, { title, location }, req.ip, req.get('user-agent'));

    // Invalidate Event Cache
    await invalidateEventCache();

    res.status(201).json(event);
});

export const approveEvent = catchAsync(async (req: AuthRequest, res: Response) => {
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
            await logAudit(user.id, 'PUBLISH', 'EVENT', id, { title: event.title }, req.ip, req.get('user-agent'));
        }
        return allApprovals.length;
    });

        // Side effects handled via transaction result logic if needed, 
        // but easier to check quorum inside and log there.

    res.json({ message: 'Approval recorded.', totalApprovals });
});

export const updateEventStatus = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { approvalStatus } = req.body;
    const user = req.user!;

    if (!['APPROVED', 'REJECTED'].includes(approvalStatus)) {
        throw new AppError('Invalid approval status', 400);
    }

    const event = await prisma.event.update({
        where: { id },
        data: { approvalStatus }
    });

    await logAudit(user.id, 'FORCE_APPROVE', 'EVENT', id, { title: event.title, approvalStatus }, req.ip, req.get('user-agent'));
    
    await invalidateEventCache();

    res.json({ message: `Event status forcefully updated to ${approvalStatus}`, event });
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
    if (event.approvalStatus === 'APPROVED' && user.role === 'DEPARTMENT_LEADER') {
        throw new AppError('OPERATIONAL LOCK: Approved events cannot be modified. Contact Palace Command for changes.', 403);
    }

    const { date: newDate, time: newTime, location: newLoc, budgetSource, pastorIds, ...rest } = req.body;

    // ─── Universal Financial Safeguard on Update ───
    const deptAccount = await prisma.account.findUnique({ where: { departmentId: event.departmentId } });
    if (!deptAccount || deptAccount.balance < 1500) {
        throw new AppError('INSUFFICIENT SECTORAL LIQUIDITY: A minimum departmental reserve of 1,500 KES is required for all operations.', 402);
    }

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

    if (event.approvalStatus === 'APPROVED' && user.role !== 'SUPER_ADMIN') {
        throw new AppError('Approved events are locked and cannot be deleted.', 403);
    }

    // Avoid interactive transactions for simple soft-delete (prevents P2028 under sync load)
    await prisma.eventApproval.deleteMany({ where: { eventId: req.params.id } });
    await prisma.event.update({
        where: { id: req.params.id },
        data: {
            deletedAt: new Date(),
            deletedBy: user.id,
            deletedReason: req.body.reason || 'Decommissioned by Sector Command',
        },
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
