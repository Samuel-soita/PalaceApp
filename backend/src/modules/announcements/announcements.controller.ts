import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { logAudit } from '../../utils/audit.js';
import { getOrSetCache, invalidateCache, liveCacheKey } from '../../utils/redis.js';
import { catchAsync, AppError } from '../../utils/errors.js';
import { canAutoPublishContent } from '../../utils/approval-utils.js';
import { assertAwaitingApproval, assertCanSetApprovalStatus, assertPastorSelection, createApprovalChain, notifyApprovers, recordApproval } from '../../utils/approval-chain.js';

export const getAnnouncements = catchAsync(async (req: Request, res: Response) => {
    const { departmentId, isGlobal, isMajor, page = '1', limit = '10' } = req.query;
    const user = (req as any).user;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};
    
    if (user.role === 'WATUA') {
        // WATUA Sees Everything
    } else if (isMajor === 'true') {
        where.isMajor = true;
        where.status = 'PUBLISHED';
    } else if (user.role === 'MEMBER') {
        where.status = 'PUBLISHED';
        where.OR = [
            { isMajor: true },
            { isGlobal: true },
            ...(user.departmentId ? [{ departmentId: user.departmentId }] : [])
        ];
    } else if (user.role === 'DEPARTMENT_LEADER' || user.role === 'PASTOR' || user.role === 'ASSOCIATE_PASTOR') {
        const managedDeptIds = user.managedDepartments?.map((d: any) => d.id) || [];
        if (user.departmentId) managedDeptIds.push(user.departmentId);

        where.OR = [
            { departmentId: { in: managedDeptIds } },
            { status: 'PUBLISHED', isMajor: true },
            { status: 'PUBLISHED', isGlobal: true }
        ];
        
        if (departmentId) {
            if (!managedDeptIds.includes(String(departmentId))) {
                where.status = 'PUBLISHED';
            }
            where.departmentId = String(departmentId);
            delete where.OR;
        }
    }

    // The church-wide ticker must never surface pending or rejected broadcasts.
    if (isGlobal === 'true') {
        where.status = 'PUBLISHED';
    }

    // Visibility depends on managed departments, so the cache is per user.
    const cacheKey = liveCacheKey('announcements', `${user.role}:${user.id}:${departmentId || 'all'}:${isGlobal || 'any'}:${isMajor || 'any'}:${page}:${limit}`);

    const result = await getOrSetCache(cacheKey, async () => {
        const [data, total] = await Promise.all([
            prisma.announcement.findMany({
                where,
                include: {
                    author: { select: { id: true, name: true } },
                    department: true,
                },
                orderBy: [
                    { eventDate: 'asc' }, // Sequential by event date (primary)
                    { priority: 'desc' }, 
                    { createdAt: 'desc' }
                ] as any,
                skip,
                take,
            }),
            prisma.announcement.count({ where })
        ]);
        return { data, total };
    }, 120); // 2 minute cache

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

// Get ALL (including pending) for admin/approvers
export const getAllAnnouncements = catchAsync(async (req: Request, res: Response) => {
    const announcements = await prisma.announcement.findMany({
        include: {
            author: { select: { id: true, name: true } },
            department: true,
        },
        orderBy: [{ createdAt: 'desc' }],
    });
    res.json(announcements);
});

export const getAnnouncementById = catchAsync(async (req: Request, res: Response) => {
    const announcement = await prisma.announcement.findUnique({
        where: { id: req.params.id },
        include: {
            author: { select: { id: true, name: true } },
            department: true,
        },
    });
    if (!announcement) throw new AppError('Announcement not found', 404);
    res.json(announcement);
});

export const createAnnouncement = catchAsync(async (req: AuthRequest, res: Response) => {
    const { title, content, priority, expiry, departmentId, isGlobal, isMajor, pastorIds, eventDate, eventTime, location } = req.body;
    const user = req.user!;

    if (!isGlobal && !isMajor && !departmentId) {
        throw new AppError('A department is required for non-global/major announcements.', 400);
    }
    
    // ─── Tactical Conflict Management (Sequential Awareness) ───
    if (eventDate && location) {
        const conflicting = await prisma.announcement.findFirst({
            where: {
                eventDate: new Date(eventDate),
                location: { equals: location, mode: 'insensitive' },
                eventTime: eventTime || undefined,
                status: { in: ['PENDING', 'PUBLISHED'] }
            } as any
        });
        if (conflicting) {
            throw new AppError(`TACTICAL CONFLICT: Another mission is already scheduled at ${location} for this date/time. Please sequence operations accordingly.`, 409);
        }
    }

    // Authorization Check for Department
    if (departmentId && user.role !== 'SUPER_ADMIN' && user.role !== 'SYSTEM_ADMIN' && user.role !== 'WATUA') {
         const isManaging = user.managedDepartments?.some((d: any) => d.id === departmentId) || user.departmentId === departmentId;
         if (!isManaging) {
             throw new AppError('Cannot create announcements for departments you do not manage', 403);
         }
    }

    const autoPublish = canAutoPublishContent(user.role);
    assertPastorSelection(autoPublish, pastorIds, 'You must select exactly 2 Pastors to authorize this broadcast.');
    const approvalNotice = {
        title: '📢 Broadcast Authorization Required',
        message: `New announcement "${title}" requires your executive clearance.`
    };
    let approverIds: string[] = [];

    const announcement = await prisma.$transaction(async (tx) => {
        const newAnnouncement = await tx.announcement.create({
            data: {
                title,
                content,
                priority: priority || 'NORMAL',
                isGlobal: !!isGlobal,
                isMajor: isMajor || false,
                status: autoPublish ? 'PUBLISHED' : 'PENDING',
                expiry: expiry ? new Date(expiry) : null,
                eventDate: eventDate ? new Date(eventDate) : null,
                eventTime: eventTime || null,
                location: location || null,
                authorId: user.id,
                departmentId: departmentId || null,
            } as any,
        });

        if (!autoPublish) {
            approverIds = await createApprovalChain(tx, 'announcement', newAnnouncement.id, pastorIds, approvalNotice);
        }

        return newAnnouncement;
    });

    await logAudit(user.id, 'CREATE', 'ANNOUNCEMENT', announcement.id, { title, isGlobal });
    notifyApprovers(approverIds, approvalNotice);
    void invalidateCache('announcements:*');

    res.status(201).json(announcement);
});

// Multi-sig approval: Bishop (SUPER_ADMIN) + 2 Pastors required
export const approveAnnouncement = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const user = req.user!;

    const announcementData = await prisma.announcement.findFirst({ where: { id, deletedAt: null } });
    if (!announcementData) throw new AppError('Announcement not found', 404);
    assertAwaitingApproval(announcementData.status);

    const { approvals, quorumMet } = await prisma.$transaction(async (tx) => {
        const { approvals, quorumMet } = await recordApproval(tx, 'announcement', id, user);

        if (quorumMet) {
            await tx.announcement.update({
                where: { id },
                            data: { status: 'PUBLISHED' }
            });

            // Notify all users if Major/Global, else notify department
            const notificationTargets = ((announcementData as any).isMajor || announcementData.isGlobal)
                ? await tx.user.findMany({ select: { id: true } })
                : await tx.user.findMany({ where: { departmentId: announcementData.departmentId }, select: { id: true } });

            await tx.notification.createMany({
                data: notificationTargets.map(u => ({
                    userId: u.id,
                    title: '📣 Announcement Published',
                    message: `"${announcementData.title}" has been approved and is now live.`
                }))
            });
        }

        return { approvals, quorumMet };
    });

    if (quorumMet) {
        await logAudit(user.id, 'PUBLISH', 'ANNOUNCEMENT', id, { title: announcementData.title });
    }
    void invalidateCache('announcements:*');

    res.json({
        message: quorumMet ? 'Announcement published.' : 'Approval recorded.',
        totalApprovals: approvals.filter((a) => a.approved).length,
        status: quorumMet ? 'PUBLISHED' : announcementData.status
    });
});

export const updateAnnouncement = catchAsync(async (req: Request, res: Response) => {
    const announcement = await prisma.announcement.findUnique({ where: { id: req.params.id } });
    if (!announcement) throw new AppError('Announcement not found', 404);

    const user = (req as any).user;
    const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(user.role);
    const isManaging = user.managedDepartments?.some((d: any) => d.id === announcement.departmentId) || user.departmentId === announcement.departmentId;
    const canUpdate = isExecutive || (user.role === 'DEPARTMENT_LEADER' && isManaging) || (!announcement.departmentId && isExecutive);

    if (!canUpdate) throw new AppError('Access denied: Executive or Sector permission required', 403);

    if (announcement.status === 'PUBLISHED' && user.role !== 'SUPER_ADMIN') {
        throw new AppError('Published announcements are locked and cannot be modified.', 403);
    }

    const { pastorIds: _pastorIds, ...data } = req.body;
    if (user.role === 'DEPARTMENT_LEADER') delete data.departmentId;
    const nextStatus = data.status;

    if (user.role === 'ASSOCIATE_PASTOR' && (Object.keys(data).length !== 1 || nextStatus !== 'REJECTED')) {
        throw new AppError('Associate pastors may only reject announcements awaiting their signature.', 403);
    }

    if (nextStatus && nextStatus !== announcement.status && (nextStatus === 'PUBLISHED' || nextStatus === 'REJECTED')) {
        await assertCanSetApprovalStatus(prisma, 'announcement', announcement.id, user, nextStatus === 'PUBLISHED' ? 'APPROVED' : 'REJECTED');
    }

    const updated = await prisma.announcement.update({
        where: { id: req.params.id },
        data,
    });

    await logAudit(user.id, 'UPDATE', 'ANNOUNCEMENT', updated.id, req.body);
    void invalidateCache('announcements:*');

    res.json(updated);
});

export const deleteAnnouncement = catchAsync(async (req: Request, res: Response) => {
    const announcement = await prisma.announcement.findUnique({ where: { id: req.params.id } });
    if (!announcement) throw new AppError('Announcement not found', 404);

    const user = (req as any).user;
    const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(user.role);
    const isManaging = user.managedDepartments?.some((d: any) => d.id === announcement.departmentId) || user.departmentId === announcement.departmentId;
    const canDelete = isExecutive || (user.role === 'DEPARTMENT_LEADER' && isManaging);

    if (!canDelete) throw new AppError('Access denied: Executive or Sector priority required', 403);

    if (announcement.status === 'PUBLISHED' && user.role !== 'SUPER_ADMIN') {
        throw new AppError('Published announcements are locked and cannot be deleted.', 403);
    }

    // Single soft-delete — no transaction or approval purge (prevents P2028 / pool exhaustion)
    await prisma.announcement.update({
        where: { id: req.params.id },
        data: { deletedAt: new Date() },
    });

    void invalidateCache('announcements:*');
    logAudit(user.id, 'DELETE', 'ANNOUNCEMENT', announcement.id, { title: announcement.title });
    res.json({ message: 'Announcement deleted successfully' });
});
