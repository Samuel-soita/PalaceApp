import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';

export const getAnnouncements = async (req: Request, res: Response) => {
    const { departmentId, isGlobal } = req.query;
    try {
        // @ts-ignore
        const announcements = await prisma.announcement.findMany({
            where: isGlobal === 'true'
                // @ts-ignore
                ? { isGlobal: true, status: 'PUBLISHED' }
                : {
                    OR: [
                        // Department-specific (always visible)
                        ...(departmentId ? [{ departmentId: departmentId as string }] : []),
                        // Global but only published ones
                        // @ts-ignore
                        { isGlobal: true, status: 'PUBLISHED' }
                    ]
                },
            include: {
                author: { select: { id: true, name: true, email: true } },
                department: true,
            },
            orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        });
        res.json(announcements);
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
                author: { select: { id: true, name: true, email: true } },
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
    const { title, content, priority, expiry, departmentId, isGlobal } = req.body;
    try {
        const announcement = await prisma.announcement.create({
            data: {
                title,
                content,
                priority: priority || 'NORMAL',
                // @ts-ignore
                isGlobal: !!isGlobal,
                // @ts-ignore
                status: isGlobal ? 'PENDING' : 'PUBLISHED',
                expiry: expiry ? new Date(expiry) : null,
                authorId: req.user!.id,
                departmentId: departmentId || null,
            },
        });

        // If global, notify Bishop and Pastors to approve
        if (isGlobal) {
            const approvers = await prisma.user.findMany({
                where: { role: { in: ['SUPER_ADMIN', 'PASTOR'] } }
            });
            if (approvers.length > 0) {
                await prisma.notification.createMany({
                    data: approvers.map(approver => ({
                        userId: approver.id,
                        title: '📢 Announcement Awaiting Approval',
                        message: `Global announcement "${title}" requires your signature to go live.`
                    }))
                });
            }
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

    // Only Bishop or Pastors can approve
    if (!['SUPER_ADMIN', 'PASTOR'].includes(user.role)) {
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

        // Publish when: 1 Bishop + 2 Pastors have signed
        if (bishopApproved && pastorCount >= 2) {
            const announcement = await prisma.announcement.update({
                where: { id },
                // @ts-ignore
                data: { status: 'PUBLISHED' }
            });

            // Notify all users
            const allUsers = await prisma.user.findMany({ select: { id: true } });
            await prisma.notification.createMany({
                data: allUsers.map(u => ({
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
        const announcement = await prisma.announcement.update({
            where: { id: req.params.id },
            data: req.body,
        });
        res.json(announcement);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to update announcement' });
    }
};

export const deleteAnnouncement = async (req: Request, res: Response) => {
    try {
        await prisma.announcement.delete({ where: { id: req.params.id } });
        res.json({ message: 'Announcement deleted successfully' });
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to delete announcement' });
    }
};
