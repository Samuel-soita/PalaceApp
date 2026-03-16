import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { logAudit } from '../../utils/audit.js';

export const getAnnouncements = async (req: Request, res: Response) => {
    const { departmentId, isGlobal, isMajor } = req.query;
    const user = (req as any).user;
    try {
        const where: any = {};
        
        if (user.role === 'WATUA') {
            // WATUA Sees Everything
        } else if (isMajor === 'true') {
            where.isMajor = true;
            where.status = 'PUBLISHED';
        } else if (user.role === 'MEMBER') {
            where.status = 'PUBLISHED';
            // MEMBER Privacy: Global OR Major OR Own Department
            where.OR = [
                { isMajor: true },
                { isGlobal: true },
                ...(user.departmentId ? [{ departmentId: user.departmentId }] : [])
            ];
        } else if (user.role === 'DEPARTMENT_LEADER') {
            // Dashboard view: own dept (any status) + published global/major
            where.OR = [
                { departmentId: user.departmentId },
                { status: 'PUBLISHED', isMajor: true },
                { status: 'PUBLISHED', isGlobal: true }
            ];
            
            // If they are explicitly filtering for a department, override logic
            if (departmentId) {
                where.departmentId = String(departmentId);
                delete where.OR;
            }
        } else if (user.role === 'SYSTEM_ADMIN' || user.role === 'SECRETARY') {
            // High authority sees everything
        }

        const announcements = await prisma.announcement.findMany({
            where,
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
    const { title, content, priority, expiry, departmentId, isGlobal, isMajor } = req.body;
    try {
        const announcement = await prisma.announcement.create({
            data: {
                title,
                content,
                priority: priority || 'NORMAL',
                // @ts-ignore
                isGlobal: !!isGlobal,
                isMajor: isMajor || false,
                status: 'PENDING', // All starts as PENDING now for approval workflow
                expiry: expiry ? new Date(expiry) : null,
                authorId: req.user!.id,
                departmentId: departmentId || null,
            } as any,
        }) as any;

        await logAudit(req.user!.id, 'CREATE', 'ANNOUNCEMENT', announcement.id, { title, isGlobal });

        // If global, notify Bishop and Pastors to approve
        if ((announcement as any).isMajor || (announcement as any).isGlobal) {
            const requiredApprovals = [];
            if ((announcement as any).isMajor) {
                const bishop = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
                if (bishop) {
                    requiredApprovals.push({ userId: bishop.id, role: 'BISHOP' });
                }
            }
            const pastors = await prisma.user.findMany({ where: { role: 'PASTOR' } });
            pastors.forEach(pastor => requiredApprovals.push({ userId: pastor.id, role: 'PASTOR' }));

            if (requiredApprovals.length > 0) {
                await prisma.notification.createMany({
                    data: requiredApprovals.map(approver => ({
                        userId: approver.userId,
                        title: '📢 Announcement Awaiting Approval',
                        message: `Announcement "${title}" requires your signature to go live.`
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

        // QUORUM RULES:
        // Major: 1 Bishop + 2 Pastors
        // Internal: 2 Pastors
        const quorumMet = (announcementData as any).isMajor || announcementData.isGlobal
            ? (bishopApproved && pastorCount >= 2)
            : (pastorCount >= 2);

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
        const canUpdate = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY'].includes(user.role) || 
                          (user.role === 'DEPARTMENT_LEADER' && user.departmentId === announcement.departmentId);

        if (!canUpdate) {
            return res.status(403).json({ error: 'Access denied' });
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

        // RBAC: Secretary cannot delete.
        if (user.role === 'SECRETARY') {
            return res.status(403).json({ error: 'Secretaries cannot delete church records' });
        }

        const canDelete = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(user.role) || 
                          (user.role === 'DEPARTMENT_LEADER' && user.departmentId === announcement.departmentId);

        if (!canDelete) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await logAudit(user.id, 'DELETE', 'ANNOUNCEMENT', announcement.id, { title: announcement.title });
        await prisma.announcement.delete({ where: { id: req.params.id } });
        res.json({ message: 'Announcement deleted successfully' });
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to delete announcement' });
    }
};
