import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';

export const createRepairRequest = async (req: Request, res: Response) => {
    try {
        const { instrumentName, problemDescription, estimatedCost, departmentId } = req.body;
        const user = (req as any).user;

        // Ensure user belongs to Technical/Sound dept (or is Admin)
        const isTechnicalDept = (departmentId || user.departmentId) === (await prisma.department.findUnique({ where: { name: 'Technical, Sound & Lighting' } }))?.id;
        
        if (!isTechnicalDept && !['SUPER_ADMIN', 'SYSTEM_ADMIN', 'WATUA'].includes(user.role)) {
            return res.status(403).json({ error: 'Only Technical/Sound members can initiate repairs.' });
        }

        // ─── Universal Financial Safeguard (Mandatory 1,500 KES Floor) ───
        const deptAccount = await prisma.account.findUnique({ where: { departmentId: departmentId || user.departmentId } });
        const minRequired = 1500;
        if (!deptAccount || deptAccount.balance < minRequired) {
            return res.status(402).json({ error: `INSUFFICIENT SECTORAL LIQUIDITY: A minimum departmental reserve of ${minRequired} KES is required for all operations (Department or Church funded). Current balance: ${deptAccount?.balance || 0} KES.` });
        }

        const repair = await prisma.technicalRepair.create({
            data: {
                instrumentName,
                problemDescription,
                estimatedCost: Number(estimatedCost),
                budgetSource: (req.body.budgetSource || 'DEPARTMENT') as any,
                departmentId: departmentId || user.departmentId,
                requesterId: user.id,
                status: 'PENDING_PASTOR_1'
            } as any,
            include: {
                department: { select: { name: true } },
                requester: { select: { name: true } }
            }
        });

        await logAudit(user.id, 'CREATE', 'TECHNICAL_REPAIR', repair.id, { instrumentName, estimatedCost });

        // --- NOTIFICATION 1: To all Pastors ---
        const pastors = await prisma.user.findMany({ 
            where: { role: 'PASTOR' } 
        });
        const notifications = pastors.map(p => ({
            userId: p.id,
            title: '🛠️ NEW REPAIR REQUEST',
            message: `A new repair for "${instrumentName}" from ${repair.department.name} requires your signature.`
        }));

        if (notifications.length > 0) {
            await prisma.notification.createMany({ data: notifications });
        }

        res.status(201).json(repair);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to create repair request' });
    }
};

export const approveRepair = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;
        const repair = await prisma.technicalRepair.findUnique({ 
            where: { id },
            include: { department: true, requester: true }
        });

        if (!repair) return res.status(404).json({ error: 'Repair not found' });

        let nextStatus = repair.status;
        let notificationTargets: string[] = [];
        let notificationMsg = '';

        // 1. Pastor 1 Approval
        if (repair.status === 'PENDING_PASTOR_1' && user.role === 'PASTOR') {
            nextStatus = 'PENDING_PASTOR_2';
            // Notify other pastors
            const otherPastors = await prisma.user.findMany({ 
                where: { role: 'PASTOR', id: { not: user.id } } 
            });
            notificationTargets = otherPastors.map(p => p.id);
            const signer = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
            notificationMsg = `${signer?.name || 'A pastor'} has signed the repair request for "${repair.instrumentName}". A second signature is required.`;
        } 
        // 2. Pastor 2 Approval
        else if (repair.status === 'PENDING_PASTOR_2' && user.role === 'PASTOR') {
            const existingApproval = await prisma.repairApproval.findFirst({
                where: { repairId: id, userId: user.id }
            });
            if (existingApproval) return res.status(400).json({ error: 'Already approved by you. Need a second pastor.' });
            
            nextStatus = 'PENDING_ADMIN';
            // Notify Admin
            const admins = await prisma.user.findMany({ where: { role: 'SYSTEM_ADMIN' } });
            notificationTargets = admins.map(a => a.id);
            notificationMsg = `Two pastors have approved the repair for "${repair.instrumentName}". Admin authorization required.`;
        }
        // 3. Admin Approval
        else if (repair.status === 'PENDING_ADMIN' && user.role === 'SYSTEM_ADMIN') {
            nextStatus = 'PENDING_BISHOP';
            // Notify Bishop
            const bishops = await prisma.user.findMany({ where: { role: 'SUPER_ADMIN' } });
            notificationTargets = bishops.map(b => b.id);
            notificationMsg = `Admin has verified the repair for "${repair.instrumentName}". Bishop final authorization required.`;
        }
        // 4. Bishop Approval
        else if (repair.status === 'PENDING_BISHOP' && user.role === 'SUPER_ADMIN') {
            nextStatus = 'APPROVED';
            // Notify Requester
            notificationTargets = [repair.requesterId];
            notificationMsg = `Hallelujah! Your repair request for "${repair.instrumentName}" has been FULLY APPROVED by the Bishop.`;
        } else {
            return res.status(403).json({ error: 'It is not your turn to approve this request or you lack permissions.' });
        }

        // Record Approval
        await prisma.repairApproval.create({
            data: {
                repairId: id,
                userId: user.id,
                role: user.role
            }
        });

        // Update Repair Status
        const updated = await prisma.technicalRepair.update({
            where: { id },
            data: { status: nextStatus }
        });

        // Send Notifications
        if (notificationTargets.length > 0) {
            await prisma.notification.createMany({
                data: notificationTargets.map(uid => ({
                    userId: uid,
                    title: '🛠️ REPAIR STATE UPDATE',
                    message: notificationMsg
                }))
            });
        }

        res.json(updated);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to approve' });
    }
};

export const getRepairs = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { departmentId } = req.query;

        const where: any = {};
        if (departmentId) where.departmentId = String(departmentId);

        // Security: Department leaders only see their own repairs
        if (user.role === 'DEPARTMENT_LEADER' && !user.managedDepartments?.some((d: any) => d.id === departmentId)) {
            where.departmentId = user.departmentId;
        }

        const repairs = await prisma.technicalRepair.findMany({
            where,
            include: {
                department: true,
                requester: { select: { id: true, name: true, role: true, avatarUrl: true } },
                approvals: { include: { user: { select: { id: true, name: true, role: true } } } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(repairs);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch repairs' });
    }
};

export const updateRepair = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;
        const repair = await prisma.technicalRepair.findUnique({ where: { id } });

        if (!repair) return res.status(404).json({ error: 'Repair not found' });

        if (user.role === 'DEPARTMENT_LEADER') {
            const ownsDept = repair.departmentId === user.departmentId
                || user.managedDepartments?.some((d: any) => d.id === repair.departmentId);
            if (!ownsDept) return res.status(403).json({ error: 'You can only edit repairs for your own department.' });
        }

        // Operational Lock
        if (repair.status === 'APPROVED' && user.role === 'DEPARTMENT_LEADER') {
            return res.status(403).json({ error: 'OPERATIONAL LOCK: Fully approved repairs are locked. Contact Admin for changes.' });
        }

        const { instrumentName, problemDescription, estimatedCost, budgetSource, status } = req.body;
        // Approval states are only reachable through the signature chain; the only manual transition is marking an approved repair as tackled.
        if (status !== undefined && !(status === 'TACKLED' && repair.status === 'APPROVED')) {
            return res.status(400).json({ error: 'Repair status can only be changed through the approval chain.' });
        }

        // ─── Universal Financial Safeguard on Update ───
        const deptAccount = await prisma.account.findUnique({ where: { departmentId: repair.departmentId } });
        if (!deptAccount || deptAccount.balance < 1500) {
            return res.status(402).json({ error: 'INSUFFICIENT SECTORAL LIQUIDITY: A minimum departmental reserve of 1,500 KES is required for all operations.' });
        }

        const updated = await prisma.technicalRepair.update({
            where: { id },
            data: {
                ...(instrumentName !== undefined && { instrumentName }),
                ...(problemDescription !== undefined && { problemDescription }),
                ...(budgetSource !== undefined && { budgetSource }),
                ...(status !== undefined && { status }),
                estimatedCost: estimatedCost ? Number(estimatedCost) : repair.estimatedCost
            }
        });

        res.json(updated);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Update failed' });
    }
};

export const deleteRepair = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;
        const repair = await prisma.technicalRepair.findUnique({ where: { id } });

        if (!repair) return res.status(404).json({ error: 'Repair not found' });

        if (user.role === 'DEPARTMENT_LEADER') {
            if (repair.status !== 'TACKLED' && repair.status !== 'REJECTED') {
                return res.status(403).json({ error: 'DELETION RESTRICTED: Repair requests can only be decommissioned after they are TACKLED.' });
            }
        } else if (repair.status === 'APPROVED' && user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'High Authorization required to delete approved repairs.' });
        }

        await prisma.technicalRepair.delete({ where: { id } });
        res.json({ message: 'Repair decommissioned.' });
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Delete failed' });
    }
};
