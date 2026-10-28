import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';
import { getOrSetCache, invalidateCache, liveCacheKey } from '../../utils/redis.js';
import { catchAsync, AppError } from '../../utils/errors.js';
import { isGlobalOperator, resolveTargetDepartmentId } from '../../utils/department-accounts.js';
import { canAutoPublishContent } from '../../utils/approval-utils.js';
import { assertAwaitingApproval, assertCanSetApprovalStatus, assertPastorSelection, createApprovalChain, notifyApprovers, publishLinkedAnnouncement, recordApproval } from '../../utils/approval-chain.js';

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

    const cacheKey = liveCacheKey('events', `${user.role}:${user.id}:${departmentId || 'all'}:${isMajor || 'any'}:${page}:${limit}`);

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
    assertPastorSelection(autoApprove, req.body.pastorIds, 'You must select exactly 2 Pastors to approve this event.');
    const approvalNotice = {
        title: '📅 Event Authorization Required',
        message: `Event "${title}" requires your approval.`
    };
    let approverIds: string[] = [];

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
                volunteersNeeded: Number(req.body.volunteersNeeded || 0),
                attachmentUrl: req.body.attachmentUrl || null,
                createdById: user.id
            } as any
        });

        if (!autoApprove) {
            approverIds = await createApprovalChain(tx, 'event', newEvent.id, req.body.pastorIds, approvalNotice);
        }

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
                departmentId: targetDeptId,
                eventId: newEvent.id
            } as any
        });

        return newEvent;
    });

    await logAudit(user.id, 'CREATE', 'EVENT', event.id, { title, location }, req.ip, req.get('user-agent'));
    notifyApprovers(approverIds, approvalNotice);

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
    
    if (!event || event.deletedAt) throw new AppError('Event not found', 404);
    assertAwaitingApproval(event.approvalStatus);

    const { approvals, quorumMet } = await prisma.$transaction(async (tx) => {
        const result = await recordApproval(tx, 'event', id, user);
        if (result.quorumMet) {
            await tx.event.update({
                where: { id },
                data: { approvalStatus: 'APPROVED' }
            });
            await publishLinkedAnnouncement(tx, 'event', event);
        }
        return result;
    });

    if (quorumMet) {
        await logAudit(user.id, 'PUBLISH', 'EVENT', id, { title: event.title }, req.ip, req.get('user-agent'));
    }
    await invalidateEventCache();

    res.json({
        message: quorumMet ? 'Event approved.' : 'Approval recorded.',
        totalApprovals: approvals.filter((a) => a.approved).length,
        approvalStatus: quorumMet ? 'APPROVED' : event.approvalStatus
    });
});

export const updateEventStatus = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { approvalStatus } = req.body;
    const user = req.user!;

    if (!['APPROVED', 'REJECTED'].includes(approvalStatus)) {
        throw new AppError('Invalid approval status', 400);
    }
    await assertCanSetApprovalStatus(prisma, 'event', id, user, approvalStatus);

    const event = await prisma.event.update({
        where: { id },
        data: { approvalStatus }
    });
    if (approvalStatus === 'APPROVED') {
        await publishLinkedAnnouncement(prisma, 'event', event);
    }

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
    if (!event || event.deletedAt) throw new AppError('Event not found.', 404);

    if (user.role === 'DEPARTMENT_LEADER') {
        const isManaging = user.managedDepartments?.some((d: any) => d.id === event.departmentId) || user.departmentId === event.departmentId;
        if (!isManaging) throw new AppError('Leaders can only update events for their own department', 403);
    }

    // ─── Operational Lock ───
    if (event.approvalStatus === 'APPROVED' && user.role === 'DEPARTMENT_LEADER') {
        throw new AppError('OPERATIONAL LOCK: Approved events cannot be modified. Contact Palace Command for changes.', 403);
    }

    const {
        date: newDate, time: newTime, location: newLoc, budgetSource,
        pastorIds: _pastorIds, approvalStatus: _approvalStatus, departmentId, ...rest
    } = req.body;
    const canMoveDepartment = isGlobalOperator(user.role) && departmentId && departmentId !== event.departmentId;

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
            ...(canMoveDepartment && { departmentId }),
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

    await prisma.event.update({
        where: { id: req.params.id },
        data: {
            deletedAt: new Date(),
            deletedBy: user.id,
            deletedReason: req.body.reason || 'Decommissioned by Sector Command',
        },
    });

    logAudit(user.id, 'DELETE', 'EVENT', event.id, { title: event.title }, req.ip, req.get('user-agent'));

    void invalidateEventCache();

    res.json({ message: 'Event deleted successfully' });
});
/**
 * ⚡ Cache Invalidation Helper
 */
async function invalidateEventCache() {
    void invalidateCache('events:*');
    void invalidateCache('announcements:*');
}
