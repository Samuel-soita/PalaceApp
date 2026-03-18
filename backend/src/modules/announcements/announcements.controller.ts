import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { logAudit } from '../../utils/audit.js';
import { getOrSetCache, invalidateCache } from '../../utils/redis.js';

export const getAnnouncements = async (req: Request, res: Response) => {
    const { departmentId, isGlobal, isMajor, page = '1', limit = '10' } = req.query;
    const user = (req as any).user;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    try {
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
        } else if (user.role === 'DEPARTMENT_LEADER' || user.role === 'PASTOR') {
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
    } catch (error: any) {
        console.error('[getAnnouncements]', error);
        res.status(500).json({ error: error.message || 'Failed to fetch announcements' });
    }
};

// Get ALL (including pending) for admin/approvers
export const getAllAnnouncements = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const announcements = await prisma.announcement.findMany({
            include: {
                author: { select: { id: true, name: true } },
                department: true,
            },
            orderBy: [{ createdAt: 'desc' }],
        });
        res.json(announcements);
    } catch (error: any) {
        console.error('[getAllAnnouncements]', error);
        res.status(500).json({ error: error.message || 'Failed to fetch announcements' });
    }
};

export const createAnnouncement = async (req: AuthRequest, res: Response) => {
    const { title, content, priority, expiry, departmentId, isGlobal, isMajor } = req.body;
    const user = req.user!;
    
    // Authorization Check
    const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR', 'SECRETARY'].includes(user.role);
    if (!isExecutive && user.role === 'DEPARTMENT_LEADER' && departmentId !== user.departmentId) {
        return res.status(403).json({ error: 'Leaders can only post announcements for their own mission sector' });
    }

    try {
        const announcement = await prisma.announcement.create({
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
        }) as any;

        await logAudit(user.id, 'CREATE', 'ANNOUNCEMENT', announcement.id, { title, isGlobal });

        // Notifications to Approvers
        const executives = await prisma.user.findMany({
            where: {
                role: { in: ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR'] }
            }
        });
        
        const notifications = executives.map((exec) => ({
            userId: exec.id,
            title: '📢 Mission Intel Awaiting Approval',
            message: `A new announcement "${title}" was proposed by ${(user as any).name || 'a leader'} and requires executive review.`
        }));

        if (notifications.length > 0) {
            await prisma.notification.createMany({ data: notifications });
        }

        res.status(201).json(announcement);
    } catch (error: any) {
        console.error('[createAnnouncement]', error);
        res.status(400).json({ error: error.message || 'Failed to create announcement' });
    }
};

// Multi-sig approval: Bishop (SUPER_ADMIN) + 2 Pastors required
export const approveAnnouncement = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const user = req.user!;

    // Only Bishop or Pastors can approve. WATUA bypass.
    if (!['SUPER_ADMIN', 'PASTOR', 'WATUA'].includes(user.role)) {
        return res.status(403).json({ error: 'Only the Bishop or Pastors can approve announcements.' });
    }

    try {
        // Check if this user already approved
        // @ts-ignore
        const existing = await prisma.announcementApproval.findUnique({
            where: { announcementId_userId: { announcementId: id, userId: user.id } }
        });
        if (existing) {
            return res.status(400).json({ error: 'You have already approved this announcement.' });
        }

        // Record approval
        // @ts-ignore
        await prisma.announcementApproval.create({
            data: {
                announcementId: id,
                userId: user.id,
                role: user.role === 'SUPER_ADMIN' ? 'BISHOP' : 'PASTOR'
            }
        });

        // Get all approvals for this announcement
        // @ts-ignore
        const allApprovals = await prisma.announcementApproval.findMany({
            where: { announcementId: id }
        });

        const bishopApproved = allApprovals.some((a: any) => a.role === 'BISHOP');
        const pastorCount = allApprovals.filter((a: any) => a.role === 'PASTOR').length;

        // Fetch the announcement to check isMajor
        const announcementData = await prisma.announcement.findUnique({ where: { id } });
        if (!announcementData) return res.status(404).json({ error: 'Announcement not found' });

        // NEW QUORUM RULES:
        // Strictly: 1 Bishop + 2 Pastors
        const quorumMet = bishopApproved && pastorCount >= 2;

        if (quorumMet) {
            const announcement = await prisma.announcement.update({
                where: { id },
                // @ts-ignore
                data: { status: 'PUBLISHED' }
            });

            await logAudit(user.id, 'PUBLISH', 'ANNOUNCEMENT', id, { title: announcement.title });

            // Notify all users if Major/Global, else notify department
            const notificationTargets = ((announcementData as any).isMajor || announcementData.isGlobal)
                ? await prisma.user.findMany({ select: { id: true } })
                : await prisma.user.findMany({ where: { departmentId: announcementData.departmentId }, select: { id: true } });

            await prisma.notification.createMany({
                data: notificationTargets.map(u => ({
                    userId: u.id,
                    title: '📣 Announcement Published',
                    message: `"${announcement?.title}" has been approved and is now live.`
                }))
            });
        }

        res.json({ message: 'Approval recorded.', totalApprovals: allApprovals.length });
    } catch (error: any) {
        console.error('[approveAnnouncement]', error);
        res.status(400).json({ error: error.message || 'Failed to approve' });
    }
};

export const updateAnnouncement = async (req: Request, res: Response) => {
    try {
        const announcement = await prisma.announcement.findUnique({ where: { id: req.params.id } });
        if (!announcement) return res.status(404).json({ error: 'Announcement not found' });

        const user = (req as any).user;
        const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(user.role);
        const isManaging = user.managedDepartments?.some((d: any) => d.id === announcement.departmentId) || user.departmentId === announcement.departmentId;
        const canUpdate = isExecutive || (user.role === 'DEPARTMENT_LEADER' && isManaging);

        if (!canUpdate) {
            return res.status(403).json({ error: 'Access denied: Executive or Sector permission required' });
        }

        const updated = await prisma.announcement.update({
            where: { id: req.params.id },
            data: req.body,
        });

        await logAudit(user.id, 'UPDATE', 'ANNOUNCEMENT', updated.id, req.body);

        res.json(updated);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to update announcement' });
    }
};

export const deleteAnnouncement = async (req: Request, res: Response) => {
    try {
        const announcement = await prisma.announcement.findUnique({ where: { id: req.params.id } });
        if (!announcement) return res.status(404).json({ error: 'Announcement not found' });

        const user = (req as any).user;
        const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(user.role);
        const isManaging = user.managedDepartments?.some((d: any) => d.id === announcement.departmentId) || user.departmentId === announcement.departmentId;
        const canDelete = isExecutive || (user.role === 'DEPARTMENT_LEADER' && isManaging);

        if (!canDelete) {
            return res.status(403).json({ error: 'Access denied: Executive or Sector priority required' });
        }

        await logAudit(user.id, 'DELETE', 'ANNOUNCEMENT', announcement.id, { title: announcement.title });
        await prisma.announcement.delete({ where: { id: req.params.id } });
        res.json({ message: 'Announcement deleted successfully' });
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to delete announcement' });
    }
};
