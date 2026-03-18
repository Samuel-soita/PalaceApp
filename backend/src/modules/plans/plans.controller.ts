import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { getOrSetCache } from '../../utils/redis.js';
import redis from '../../utils/redis.js';

export const getPlans = async (req: Request, res: Response) => {
    try {
        const { departmentId, isMajor, page = '1', limit = '10' } = req.query;
        const user = (req as any).user;
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        if (!user) {
            return res.status(401).json({ error: 'User context missing' });
        }

        const where: any = {};
        if (departmentId) where.departmentId = String(departmentId);
        if (isMajor !== undefined) where.isMajor = isMajor === 'true';

        if (user.role === 'WATUA') {
        } else if (isMajor === 'true') {
            where.approvalStatus = 'APPROVED';
            where.isMajor = true;
        } else if (user.role === 'MEMBER') {
            where.approvalStatus = 'APPROVED';
            where.OR = [
                { isMajor: true },
                ...(user.departmentId ? [{ departmentId: user.departmentId }] : [])
            ];
        } else if (user.role === 'DEPARTMENT_LEADER' || user.role === 'PASTOR') {
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
        } else if (user.role === 'SYSTEM_ADMIN' || user.role === 'SECRETARY' || user.role === 'SUPER_ADMIN') {
            if (departmentId) {
                where.departmentId = String(departmentId);
            } else if (isMajor === undefined) {
                where.OR = [
                    { isMajor: true },
                    ...(user.departmentId ? [{ departmentId: user.departmentId }] : [])
                ];
            }
        }

        const cacheKey = `plans:${user.role}:${user.departmentId || 'none'}:${departmentId || 'all'}:${isMajor || 'any'}:${page}:${limit}`;

        const result = await getOrSetCache(cacheKey, async () => {
            const [data, total] = await Promise.all([
                prisma.plan.findMany({
                    where,
                    include: { department: true },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take,
                }),
                prisma.plan.count({ where })
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
    
    const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR', 'SECRETARY'].includes(req.user!.role);
    const isManaging = req.user!.managedDepartments?.some((d: any) => d.id === departmentId) || req.user!.departmentId === departmentId;
    
    if (!isExecutive && req.user!.role === 'DEPARTMENT_LEADER' && !isManaging) {
        return res.status(403).json({ error: 'Leaders can only create plans for their own mission sector' });
    }
    
    if (req.user!.role === 'MEMBER') {
        return res.status(403).json({ error: 'Members cannot create tactical plans' });
    }

    if (!pastorIds || !Array.isArray(pastorIds) || pastorIds.length !== 2) {
        return res.status(400).json({ error: 'Exactly 2 pastors required' });
    }

    try {
        const plan = await prisma.plan.create({
            data: {
                type, title, description, departmentId,
                isMajor: req.body.isMajor === true,
                approvalStatus: 'PENDING_APPROVAL',
            },
        });

        await logAudit(req.user!.id, 'CREATE', 'PLAN', plan.id, { title, type });

        // Invalidate Cache
        const keys = await redis.keys('plans:*');
        if (keys.length > 0) await redis.del(...keys);

        res.status(201).json(plan);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to create plan' });
    }
};

export const approvePlan = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const user = req.user!;

    if (!['SUPER_ADMIN', 'PASTOR', 'WATUA'].includes(user.role)) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const plan = await prisma.plan.findUnique({ 
            where: { id },
            include: { department: true }
        });
        if (!plan) return res.status(404).json({ error: 'Plan not found' });

        const existing = await prisma.planApproval.findUnique({
            where: { planId_userId: { planId: id, userId: user.id } }
        });
        if (existing) return res.status(400).json({ error: 'Already approved' });

        await prisma.planApproval.create({
            data: {
                planId: id,
                userId: user.id,
                role: user.role === 'SUPER_ADMIN' ? 'BISHOP' : 'PASTOR'
            }
        });

        const allApprovals = await prisma.planApproval.findMany({ where: { planId: id } });
        const bishopApproved = allApprovals.some((a: any) => a.role === 'BISHOP');
        const pastorCount = allApprovals.filter((a: any) => a.role === 'PASTOR').length;

        const quorumMet = bishopApproved && pastorCount >= 2;

        if (quorumMet) {
            await prisma.plan.update({
                where: { id },
                data: { approvalStatus: 'APPROVED' }
            });

            await logAudit(user.id, 'PUBLISH', 'PLAN', id, { title: plan.title });

            // Invalidate Cache
            const keys = await redis.keys('plans:*');
            if (keys.length > 0) await redis.del(...keys);
        }

        res.json({ message: 'Approval recorded', totalApprovals: allApprovals.length });
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to approve plan' });
    }
};

export const updatePlan = async (req: AuthRequest, res: Response) => {
    try {
        const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
        if (!plan) return res.status(404).json({ error: 'Plan not found' });

        const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(req.user!.role);
        const isManaging = req.user!.managedDepartments?.some((d: any) => d.id === plan.departmentId) || req.user!.departmentId === plan.departmentId;
        const canUpdate = isExecutive || (req.user!.role === 'DEPARTMENT_LEADER' && isManaging);

        if (!canUpdate) return res.status(403).json({ error: 'Access denied: Executive or Sector permission required' });

        const updatedPlan = await prisma.plan.update({
            where: { id: req.params.id },
            data: req.body,
        });

        await logAudit(req.user!.id, 'UPDATE', 'PLAN', updatedPlan.id, req.body);

        // Invalidate Cache
        const keys = await redis.keys('plans:*');
        if (keys.length > 0) await redis.del(...keys);

        res.json(updatedPlan);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to update plan' });
    }
};

export const deletePlan = async (req: any, res: Response) => {
    try {
        const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
        if (!plan) return res.status(404).json({ error: 'Plan not found' });

        const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(req.user.role);
        const isManaging = req.user.managedDepartments?.some((d: any) => d.id === plan.departmentId) || req.user.departmentId === plan.departmentId;
        const canDelete = isExecutive || (req.user.role === 'DEPARTMENT_LEADER' && isManaging);

        if (!canDelete) return res.status(403).json({ error: 'Access denied: Executive or Sector priority required' });

        await logAudit(req.user.id, 'DELETE', 'PLAN', plan.id, { title: plan.title });
        await prisma.plan.delete({ where: { id: req.params.id } });

        // Invalidate Cache
        const keys = await redis.keys('plans:*');
        if (keys.length > 0) await redis.del(...keys);

        res.json({ message: 'Plan deleted successfully' });
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to delete plan' });
    }
};
