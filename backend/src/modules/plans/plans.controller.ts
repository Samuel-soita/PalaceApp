import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';

export const getPlans = async (req: Request, res: Response) => {
    try {
        const { departmentId, isMajor } = req.query;
        const user = (req as any).user;

        if (!user) {
            return res.status(401).json({ error: 'User context missing' });
        }

        const where: any = {};
        if (departmentId) where.departmentId = String(departmentId);
        if (isMajor !== undefined) where.isMajor = isMajor === 'true';

        // VISIBILITY RULES:
        if (user.role === 'WATUA') {
            // WATUA Sees Everything
        } else if (isMajor === 'true') {
            where.approvalStatus = 'APPROVED';
            where.isMajor = true;
        } else if (user.role === 'MEMBER') {
            where.approvalStatus = 'APPROVED';
            // MEMBER Privacy: Major OR Own Department
            where.OR = [
                { isMajor: true },
                ...(user.departmentId ? [{ departmentId: user.departmentId }] : [])
            ];
        } else if (user.role === 'DEPARTMENT_LEADER') {
            // Dashboard view: own dept (any status) OR approved major items
            if (!departmentId) {
                where.OR = [
                    { departmentId: user.departmentId },
                    { approvalStatus: 'APPROVED', isMajor: true }
                ];
            } else {
                where.departmentId = String(departmentId);
            }
        } else if (user.role === 'SYSTEM_ADMIN' || user.role === 'SECRETARY' || user.role === 'SUPER_ADMIN') {
            // Church Admin, Secretary, and Bishop see all major plans by default
            // If viewing a specific department, they can see those too
            if (departmentId) {
                where.departmentId = String(departmentId);
            } else if (isMajor === undefined) {
                // If fetching the general list, they see everything major or their own data
                where.OR = [
                    { isMajor: true },
                    ...(user.departmentId ? [{ departmentId: user.departmentId }] : [])
                ];
            }
        }

        const plans = await prisma.plan.findMany({
            where,
            include: { department: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(plans);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch plans' });
    }
};

export const getPlansByDepartment = async (req: Request, res: Response) => {
    try {
        const plans = await prisma.plan.findMany({
            where: { departmentId: req.params.departmentId },
            include: { department: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(plans);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch plans' });
    }
};

export const createPlan = async (req: AuthRequest, res: Response) => {
    const { type, title, description, departmentId, pastorIds } = req.body;
    
    // RBAC: Only SUPER_ADMIN, SYSTEM_ADMIN, SECRETARY or DEPARTMENT_LEADER can create.
    if (req.user!.role === 'DEPARTMENT_LEADER' && req.user!.departmentId !== departmentId) {
        return res.status(403).json({ error: 'You can only create plans for your own department' });
    }

    if (req.user!.role === 'MEMBER') {
        return res.status(403).json({ error: 'Members cannot create plans' });
    }

    // Must pick exactly 2 pastors
    if (!pastorIds || !Array.isArray(pastorIds) || pastorIds.length !== 2) {
        return res.status(400).json({ error: 'You must select exactly 2 Pastors to approve this plan.' });
    }

    try {
        const plan = await prisma.plan.create({
            data: {
                type, title, description, departmentId,
                isMajor: req.body.isMajor === true,
                // @ts-ignore
                approvalStatus: 'PENDING_APPROVAL',
            },
        });

        await logAudit(req.user!.id, 'CREATE', 'PLAN', plan.id, { title, type });

        // Notify Bishop and the 2 assigned Pastors
        const bishop = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
        
        const notifications = [];
        if (bishop) {
            notifications.push({
                userId: bishop.id,
                title: '📋 Plan Awaiting Approval',
                message: `Plan "${title}" by ${(req.user as any).name} requires your authorization.`
            });
        }
        
        for (const pastorId of pastorIds) {
            notifications.push({
                userId: pastorId,
                title: '📋 Plan Awaiting Your Signature',
                message: `You were selected to review Plan "${title}" by ${(req.user as any).name}.`
            });
        }

        if (notifications.length > 0) {
            await prisma.notification.createMany({ data: notifications });
        }

        res.status(201).json(plan);
    } catch (error: any) {
        console.error('[createPlan]', error);
        res.status(400).json({ error: error.message || 'Failed to create plan' });
    }
};

// 3-sig quorum: 1 Bishop + 2 Pastors
export const approvePlan = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const user = req.user!;

    if (!['SUPER_ADMIN', 'PASTOR', 'WATUA'].includes(user.role)) {
        return res.status(403).json({ error: 'Only the Bishop or Pastors can approve plans.' });
    }

    try {
        const plan = await prisma.plan.findUnique({ 
            where: { id },
            include: { department: true }
        });
        if (!plan) return res.status(404).json({ error: 'Plan not found' });

        // Check if already approved
        // @ts-ignore
        const existing = await prisma.planApproval.findUnique({
            where: { planId_userId: { planId: id, userId: user.id } }
        });
        if (existing) return res.status(400).json({ error: 'You have already approved this plan.' });

        // Record approval
        // @ts-ignore
        await prisma.planApproval.create({
            data: {
                planId: id,
                userId: user.id,
                role: user.role === 'SUPER_ADMIN' ? 'BISHOP' : 'PASTOR'
            }
        });

        // Get all approvals
        // @ts-ignore
        const allApprovals = await prisma.planApproval.findMany({ where: { planId: id } });
        const bishopApproved = allApprovals.some((a: any) => a.role === 'BISHOP');
        const pastorCount = allApprovals.filter((a: any) => a.role === 'PASTOR').length;

        // NEW QUORUM RULES:
        // Major: 1 Bishop + 2 Pastors
        // Department-only: 2 Pastors
        const quorumMet = plan.isMajor 
            ? (bishopApproved && pastorCount >= 2)
            : (pastorCount >= 2);

        if (quorumMet) {
            await prisma.plan.update({
                where: { id },
                // @ts-ignore
                data: { approvalStatus: 'APPROVED' }
            });

            // Notify Stakeholders
            const leaders = await prisma.user.findMany({
                where: { role: 'DEPARTMENT_LEADER' }
            });
            
            const message = plan.isMajor 
                ? `MAJOR STRAGETIC PLAN APPROVED: "${plan.title}" is now church-wide board ready!`
                : `Internal Sector Plan Approved: "${plan.title}" is now operational for the ${plan.department.name} department.`;

            await prisma.notification.createMany({
                data: leaders.map(l => ({
                    userId: l.id,
                    title: '✅ Plan Fully Authorized',
                    message
                }))
            });
        }

        res.json({ message: 'Approval recorded.', totalApprovals: allApprovals.length });
    } catch (error: any) {
        console.error('[approvePlan]', error);
        res.status(400).json({ error: error.message || 'Failed to approve plan' });
    }
};
export const updatePlan = async (req: AuthRequest, res: Response) => {
    try {
        const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
        if (!plan) return res.status(404).json({ error: 'Plan not found' });

        const canUpdate = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY'].includes(req.user!.role) || 
                          (req.user!.role === 'DEPARTMENT_LEADER' && req.user!.departmentId === plan.departmentId);

        if (!canUpdate) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const updatedPlan = await prisma.plan.update({
            where: { id: req.params.id },
            data: req.body,
        });

        await logAudit(req.user!.id, 'UPDATE', 'PLAN', updatedPlan.id, req.body);

        res.json(updatedPlan);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to update plan' });
    }
};

export const deletePlan = async (req: any, res: Response) => {
    try {
        const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
        if (!plan) return res.status(404).json({ error: 'Plan not found' });

        // RBAC: Secretary cannot delete.
        if (req.user.role === 'SECRETARY') {
            return res.status(403).json({ error: 'Secretaries cannot delete church records' });
        }

        const canDelete = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(req.user.role) || 
                          (req.user.role === 'DEPARTMENT_LEADER' && req.user.departmentId === plan.departmentId);

        if (!canDelete) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await logAudit(req.user.id, 'DELETE', 'PLAN', plan.id, { title: plan.title });
        await prisma.plan.delete({ where: { id: req.params.id } });
        res.json({ message: 'Plan deleted successfully' });
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to delete plan' });
    }
};
