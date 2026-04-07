import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { logAudit } from '../../utils/audit.js';
import { getOrSetCache, invalidateCache } from '../../utils/redis.js';
import { hasPermission } from '../../utils/permissions.js';
import { catchAsync, AppError } from '../../utils/errors.js';

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

    // Cache Key based on user role, department, and filters
    const cacheKey = `announcements:${user.role}:${user.departmentId || 'none'}:${departmentId || 'all'}:${isGlobal || 'any'}:${isMajor || 'any'}:${page}:${limit}`;

    const result = await getOrSetCache(cacheKey, async () => {
        const [data, total] = await Promise.all([
            prisma.announcement.findMany({
                where,
                include: {
                    author: { select: { id: true, name: true } },
                    department: true,
                },
                orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
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

export const createAnnouncement = catchAsync(async (req: AuthRequest, res: Response) => {
    const { title, content, priority, expiry, departmentId, isGlobal, isMajor, pastorIds } = req.body;
    const user = req.user!;

    if (!isGlobal && !isMajor && !departmentId) {
        throw new AppError('A department is required for non-global/major announcements.', 400);
    }
    
    // Authorization Check for Department
    if (departmentId && user.role !== 'SUPER_ADMIN' && user.role !== 'SYSTEM_ADMIN' && user.role !== 'WATUA') {
         const isManaging = user.managedDepartments?.some((d: any) => d.id === departmentId) || user.departmentId === departmentId;
         if (!isManaging) {
             throw new AppError('Cannot create announcements for departments you do not manage', 403);
         }
    }

    const announcement = await prisma.$transaction(async (tx) => {
        const newAnnouncement = await tx.announcement.create({
            data: {
                title,
                content,
                priority: priority || 'NORMAL',
                isGlobal: !!isGlobal,
                isMajor: isMajor || false,
                status: 'PENDING',
                expiry: expiry ? new Date(expiry) : null,
                authorId: user.id,
                departmentId: departmentId || null,
            } as any,
        });

        // 👨‍⚖️ Initializing Approval Chain for Announcements
        const approvalData: any[] = (pastorIds || []).map((pid: string) => ({
            announcementId: newAnnouncement.id,
            userId: pid,
            role: 'PASTOR'
        }));

        // Add Bishop (SUPER_ADMIN)
        const bishop = await tx.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
        if (bishop) {
            approvalData.push({
                announcementId: newAnnouncement.id,
                userId: bishop.id,
                role: 'SUPER_ADMIN'
            });
        }

        if (approvalData.length > 0) {
            await tx.announcementApproval.createMany({ data: approvalData });
            
            // Notifications to Authorizers
            const notifications = approvalData.map((app: any) => ({
                userId: app.userId,
                title: '📢 Broadcast Authorization Required',
                message: `New announcement "${title}" requires your executive clearance.`
            }));
            await tx.notification.createMany({ data: notifications });
        }
        
        return newAnnouncement;
    });

    await logAudit(user.id, 'CREATE', 'ANNOUNCEMENT', announcement.id, { title, isGlobal });

    res.status(201).json(announcement);
});

// Multi-sig approval: Bishop (SUPER_ADMIN) + 2 Pastors required
export const approveAnnouncement = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const user = req.user!;

    const existing = await prisma.announcementApproval.findUnique({
        where: { announcementId_userId: { announcementId: id, userId: user.id } }
    });
    
    if (existing) throw new AppError('You have already approved this announcement.', 400);

    const announcementData = await prisma.announcement.findUnique({ where: { id } });
    if (!announcementData) throw new AppError('Announcement not found', 404);

    const totalApprovals = await prisma.$transaction(async (tx) => {
        // Record approval
            await tx.announcementApproval.create({
            data: {
                announcementId: id,
                userId: user.id,
                role: user.role === 'SUPER_ADMIN' ? 'BISHOP' : (['PASTOR', 'ASSOCIATE_PASTOR'].includes(user.role) ? 'PASTOR' : user.role)
            }
        });

        // Get all approvals for this announcement
            const allApprovals = await tx.announcementApproval.findMany({
            where: { announcementId: id }
        });

        const bishopApproved = allApprovals.some((a: any) => a.role === 'BISHOP');
        const pastorCount = allApprovals.filter((a: any) => a.role === 'PASTOR').length;

        // Strictly: 1 Bishop + 2 Pastors
        const quorumMet = bishopApproved && pastorCount >= 2;

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

        return allApprovals.length;
    });

    const refreshedAnnouncement = await prisma.announcement.findUnique({ where: { id } });
    if(refreshedAnnouncement?.status === 'PUBLISHED') {
        await logAudit(user.id, 'PUBLISH', 'ANNOUNCEMENT', id, { title: announcementData.title });
    }

    res.json({ message: 'Approval recorded.', totalApprovals });
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

    const updated = await prisma.announcement.update({
        where: { id: req.params.id },
        data: req.body,
    });

    await logAudit(user.id, 'UPDATE', 'ANNOUNCEMENT', updated.id, req.body);

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

    await prisma.$transaction(async (tx) => {
        await tx.announcement.update({
            where: { id: req.params.id },
            data: { deletedAt: new Date() }
        });
        
        // Remove related approvals hard-delete
            await tx.announcementApproval.deleteMany({ where: { announcementId: req.params.id } });
    });

    await logAudit(user.id, 'DELETE', 'ANNOUNCEMENT', announcement.id, { title: announcement.title });
    res.json({ message: 'Announcement deleted successfully' });
});
