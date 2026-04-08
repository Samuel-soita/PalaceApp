import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { getOrSetCache } from '../../utils/redis.js';
import redis from '../../utils/redis.js';
import { catchAsync, AppError } from '../../utils/errors.js';

export const getPlans = catchAsync(async (req: AuthRequest, res: Response) => {
    const { departmentId, isMajor, page = '1', limit = '10' } = req.query;
    const user = req.user!;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = { deletedAt: null };
    if (departmentId) where.departmentId = String(departmentId);
    
    // Visibility logic will handle isMajor within OR blocks for non-admins
    if ((user.role === 'WATUA' || user.role === 'SUPER_ADMIN') && isMajor !== undefined) {
        where.isMajor = isMajor === 'true';
    }

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

export const getPlansByDepartment = catchAsync(async (req: AuthRequest, res: Response) => {
    const plans = await prisma.plan.findMany({
        where: { 
            departmentId: req.params.departmentId,
            deletedAt: null // IMPORTANT: Filter out soft-deleted records
        },
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

    // ─── Universal Financial Safeguard (Mandatory 1,500 KES Floor) ───
    const deptAccount = await prisma.account.findUnique({ where: { departmentId: targetDeptId } });
    const minRequired = 1500;
    if (!deptAccount || deptAccount.balance < minRequired) {
        throw new AppError(`INSUFFICIENT SECTORAL LIQUIDITY: A minimum departmental reserve of ${minRequired} KES is required for all operations (Department or Church funded). Current balance: ${deptAccount?.balance || 0} KES.`, 402);
    }

    const plan = await prisma.$transaction(async (tx) => {
        const newPlan = await tx.plan.create({
            data: {
                type, title, content: description || req.body.content || "",
                departmentId: targetDeptId,
                budgetSource: (req.body.budgetSource || 'DEPARTMENT') as any, // Cast for type sync
                isMajor: req.body.isMajor === true,
                approvalStatus: 'PENDING_APPROVAL',
                status: 'PLANNED',
            } as any,
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

    const user = req.user!;
    await logAudit(user.id, 'CREATE', 'PLAN', plan.id, { title, type }, req.ip, req.get('user-agent'));

    // Invalidate Cache
    await invalidatePlanCache();

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
        await logAudit(user.id, 'PUBLISH', 'PLAN', id, { title: planData.title }, req.ip, req.get('user-agent'));
        
        // Invalidate Cache
        await invalidatePlanCache();
    }

    res.json({ message: 'Approval recorded', totalApprovals });
});

export const updatePlanStatus = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { approvalStatus } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(approvalStatus)) {
        throw new AppError('Invalid approval status', 400);
    }

    const plan = await prisma.plan.update({
        where: { id },
        data: { approvalStatus }
    });

    const user = req.user!;
    await logAudit(user.id, 'FORCE_APPROVE', 'PLAN', id, { title: plan.title, approvalStatus }, req.ip, req.get('user-agent'));
    
    // Invalidate plan cache
    await invalidatePlanCache();

    res.json({ message: `Plan status forcefully updated to ${approvalStatus}`, plan });
});

export const updatePlan = catchAsync(async (req: AuthRequest, res: Response) => {
    const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
    if (!plan) throw new AppError('Plan not found', 404);

    const user = req.user!;
    const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(user.role);
    const isManaging = user.managedDepartments?.some((d: any) => d.id === plan.departmentId) || user.departmentId === plan.departmentId;
    const canUpdate = isExecutive || (user.role === 'DEPARTMENT_LEADER' && isManaging);

    if (!canUpdate) throw new AppError('Access denied: Executive or Sector permission required', 403);

    if (plan.approvalStatus === 'APPROVED' && user.role === 'DEPARTMENT_LEADER') {
        throw new AppError('OPERATIONAL LOCK: Approved plans are frozen. Contact Palace Command for modifications.', 403);
    }

    // ─── Universal Financial Safeguard on Update ───
    const deptAccount = await prisma.account.findUnique({ where: { departmentId: plan.departmentId } });
    if (!deptAccount || deptAccount.balance < 1500) {
        throw new AppError('INSUFFICIENT SECTORAL LIQUIDITY: A minimum departmental reserve of 1,500 KES is required for all operations.', 402);
    }

    const { description, ...rest } = req.body;
    
    // Explicit Mapping for Database Consistency
    const updateData = {
        ...rest,
        content: description || req.body.content || plan.content,
    };

    // Remove pastorIds if present (handled via specific auth logic in future or create-only)
    delete (updateData as any).pastorIds;

    const updatedPlan = await prisma.plan.update({
        where: { id: req.params.id },
        data: updateData,
    });

    await logAudit(user.id, 'UPDATE', 'PLAN', updatedPlan.id, req.body, req.ip, req.get('user-agent'));

    // Invalidate Cache
    await invalidatePlanCache();

    res.json(updatedPlan);
});

export const deletePlan = catchAsync(async (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
    if (!plan) throw new AppError('Plan not found', 404);

    if (user.role === 'SECRETARY') {
        throw new AppError('Secretaries cannot delete church records', 403);
    }

    const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(user.role);
    const isManaging = user.managedDepartments?.some((d: any) => d.id === plan.departmentId) || user.departmentId === plan.departmentId;
    const canDelete = isExecutive || (user.role === 'DEPARTMENT_LEADER' && isManaging);

    if (!canDelete) throw new AppError('Access denied: Executive or Sector priority required', 403);

    if (user.role === 'DEPARTMENT_LEADER') {
        if (plan.status !== 'COMPLETED' && plan.status !== 'TACKLED' && plan.status !== 'REJECTED') {
            throw new AppError('DELETION RESTRICTED: Plans can only be decommissioned after achievement (COMPLETED/TACKLED).', 403);
        }
    } else if (plan.approvalStatus === 'APPROVED' && user.role !== 'SUPER_ADMIN') {
        throw new AppError('Approved plans require High Authorization to decommission.', 403);
    }

    await prisma.$transaction(async (tx) => {
        await tx.plan.update({
            where: { id: req.params.id },
            data: { 
                deletedAt: new Date(),
                deletedBy: user.id
            }
        });
        
        // Remove approvals
        await tx.planApproval.deleteMany({ where: { planId: req.params.id } });
    });

    await logAudit(user.id, 'DELETE', 'PLAN', plan.id, { title: plan.title }, req.ip, req.get('user-agent'));

    await invalidatePlanCache();

    res.json({ message: 'Plan deleted successfully' });
});

/**
 * ⚡ Cache Invalidation Helper
 */
async function invalidatePlanCache() {
    const keys = await redis.keys('plans:*');
    if (keys.length > 0) await redis.del(...keys);
}
