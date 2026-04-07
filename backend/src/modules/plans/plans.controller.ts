import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { getOrSetCache } from '../../utils/redis.js';
import redis from '../../utils/redis.js';
import { catchAsync, AppError } from '../../utils/errors.js';

export const getPlans = catchAsync(async (req: Request, res: Response) => {
    const { departmentId, isMajor, page = '1', limit = '10' } = req.query;
    const user = (req as any).user;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    if (!user) {
        throw new AppError('User context missing', 401);
    }

    const where: any = {};
    if (departmentId) where.departmentId = String(departmentId);
    if (isMajor !== undefined) where.isMajor = isMajor === 'true';

    if (user.role === 'WATUA') {
        // WATUA (Omni-Inspector) has global read access, no additional filters needed
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
});

export const getPlansByDepartment = catchAsync(async (req: Request, res: Response) => {
    const plans = await prisma.plan.findMany({
        where: { departmentId: req.params.departmentId },
        include: { department: true },
        orderBy: { createdAt: 'desc' },
    });
    res.json(plans);
});

export const createPlan = catchAsync(async (req: AuthRequest, res: Response) => {
    const { type, title, description, departmentId, pastorIds } = req.body;
    
    const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR', 'SECRETARY'].includes(req.user!.role);
    const targetDeptId = departmentId || req.user?.departmentId;
    const isManaging = req.user!.managedDepartments?.some((d: any) => d.id === targetDeptId) || req.user!.departmentId === targetDeptId;
    
    if (!isExecutive && req.user!.role === 'DEPARTMENT_LEADER' && !isManaging) {
        throw new AppError('Leaders can only create plans for their own mission sector', 403);
    }

    const plan = await prisma.$transaction(async (tx) => {
        const newPlan = await tx.plan.create({
            data: {
                type, title, description,
                departmentId: targetDeptId,
                isMajor: req.body.isMajor === true,
                approvalStatus: 'PENDING_APPROVAL',
            },
        });

        // 👨‍⚖️ Initializing Approval Chain for Plans
        const approvalData: any[] = (pastorIds || []).map((pid: string) => ({
            planId: newPlan.id,
            userId: pid,
            role: 'PASTOR'
        }));

        // Add Bishop (SUPER_ADMIN)
        const bishop = await tx.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
        if (bishop) {
            approvalData.push({
                planId: newPlan.id,
                userId: bishop.id,
                role: 'SUPER_ADMIN'
            });
        }

        if (approvalData.length > 0) {
            await tx.planApproval.createMany({ data: approvalData });
            
            // 🔔 Notify Authorizers
            const notifications = approvalData.map((app: any) => ({
                userId: app.userId,
                title: '📜 Plan Authorization Required',
                message: `New strategic plan "${title}" requires your executive approval.`
            }));
            await tx.notification.createMany({ data: notifications });
        }
        
        return newPlan;
    });

    await logAudit(req.user!.id, 'CREATE', 'PLAN', plan.id, { title, type });

    // Invalidate Cache
    const keys = await redis.keys('plans:*');
    if (keys.length > 0) await redis.del(...keys);

    res.status(201).json(plan);
});

export const approvePlan = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const user = req.user!;

    const existing = await prisma.planApproval.findUnique({
        where: { planId_userId: { planId: id, userId: user.id } }
    });
    if (existing) throw new AppError('Already approved', 400);

    const planData = await prisma.plan.findUnique({ where: { id } });
    if (!planData) throw new AppError('Plan not found', 404);

    const totalApprovals = await prisma.$transaction(async (tx) => {
        await tx.planApproval.create({
            data: {
                planId: id,
                userId: user.id,
                role: user.role === 'SUPER_ADMIN' ? 'BISHOP' : (['PASTOR', 'ASSOCIATE_PASTOR'].includes(user.role) ? 'PASTOR' : user.role)
            }
        });

        const allApprovals = await tx.planApproval.findMany({ where: { planId: id } });
        const bishopApproved = allApprovals.some((a: any) => a.role === 'BISHOP');
        const pastorCount = allApprovals.filter((a: any) => a.role === 'PASTOR').length;

        const quorumMet = bishopApproved && pastorCount >= 2;

        if (quorumMet) {
            await tx.plan.update({
                where: { id },
                data: { approvalStatus: 'APPROVED' }
            });
        }
        return allApprovals.length;
    });

    const refreshedPlan = await prisma.plan.findUnique({ where: { id } });
    if (refreshedPlan?.approvalStatus === 'APPROVED') {
        await logAudit(user.id, 'PUBLISH', 'PLAN', id, { title: planData.title });
        
        // Invalidate Cache
        const keys = await redis.keys('plans:*');
        if (keys.length > 0) await redis.del(...keys);
    }

    res.json({ message: 'Approval recorded', totalApprovals });
});

export const updatePlan = catchAsync(async (req: AuthRequest, res: Response) => {
    const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
    if (!plan) throw new AppError('Plan not found', 404);

    const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(req.user!.role);
    const isManaging = req.user!.managedDepartments?.some((d: any) => d.id === plan.departmentId) || req.user!.departmentId === plan.departmentId;
    const canUpdate = isExecutive || (req.user!.role === 'DEPARTMENT_LEADER' && isManaging);

    if (!canUpdate) throw new AppError('Access denied: Executive or Sector permission required', 403);

    if (plan.approvalStatus === 'APPROVED' && req.user!.role !== 'SUPER_ADMIN') {
        throw new AppError('Approved plans are locked and cannot be modified.', 403);
    }

    const updatedPlan = await prisma.plan.update({
        where: { id: req.params.id },
        data: req.body,
    });

    await logAudit(req.user!.id, 'UPDATE', 'PLAN', updatedPlan.id, req.body);

    // Invalidate Cache
    const keys = await redis.keys('plans:*');
    if (keys.length > 0) await redis.del(...keys);

    res.json(updatedPlan);
});

export const deletePlan = catchAsync(async (req: any, res: Response) => {
    const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
    if (!plan) throw new AppError('Plan not found', 404);

    const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(req.user.role);
    const isManaging = req.user.managedDepartments?.some((d: any) => d.id === plan.departmentId) || req.user.departmentId === plan.departmentId;
    const canDelete = isExecutive || (req.user.role === 'DEPARTMENT_LEADER' && isManaging);

    if (!canDelete) throw new AppError('Access denied: Executive or Sector priority required', 403);

    if (plan.approvalStatus === 'APPROVED' && req.user.role !== 'SUPER_ADMIN') {
        throw new AppError('Approved plans are locked and cannot be deleted.', 403);
    }

    await prisma.$transaction(async (tx) => {
        await tx.plan.update({
            where: { id: req.params.id },
            data: { deletedAt: new Date() }
        });
        
        // Remove approvals
        await tx.planApproval.deleteMany({ where: { planId: req.params.id } });
    });

    await logAudit(req.user.id, 'DELETE', 'PLAN', plan.id, { title: plan.title });

    // Invalidate Cache
    const keys = await redis.keys('plans:*');
    if (keys.length > 0) await redis.del(...keys);

    res.json({ message: 'Plan deleted successfully' });
});
