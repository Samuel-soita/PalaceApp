import { Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { getOrSetCache, invalidateCache, liveCacheKey } from '../../utils/redis.js';
import { catchAsync, AppError } from '../../utils/errors.js';
import { isGlobalOperator, resolveTargetDepartmentId } from '../../utils/department-accounts.js';
import { canAutoPublishContent } from '../../utils/approval-utils.js';
import { assertAwaitingApproval, assertCanSetApprovalStatus, assertPastorSelection, createApprovalChain, notifyApprovers, recordApproval } from '../../utils/approval-chain.js';

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

    const cacheKey = liveCacheKey('plans', `${user.role}:${user.id}:${departmentId || 'all'}:${isMajor || 'any'}:${page}:${limit}`);

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

export const getPlanById = catchAsync(async (req: AuthRequest, res: Response) => {
    const plan = await prisma.plan.findFirst({
        where: { id: req.params.id, deletedAt: null },
        include: { department: true }
    });
    if (!plan) throw new AppError('Plan not found', 404);
    res.json(plan);
});

export const createPlan = catchAsync(async (req: AuthRequest, res: Response) => {
    const { type, title, description, departmentId, pastorIds } = req.body;
    
    const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR', 'SECRETARY'].includes(req.user!.role);
    const targetDeptId = resolveTargetDepartmentId(req.user!.role, req.user?.departmentId, departmentId);
    const isManaging = req.user!.managedDepartments?.some((d: any) => d.id === targetDeptId) || req.user!.departmentId === targetDeptId;
    
    if (!targetDeptId) {
        throw new AppError('Department is required to create a plan.', 400);
    }

    if (!isExecutive && req.user!.role === 'DEPARTMENT_LEADER' && !isManaging) {
        throw new AppError('Leaders can only create plans for their own mission sector', 403);
    }

    // ─── Universal Financial Safeguard (Mandatory 1,500 KES Floor) ───
    if (!isGlobalOperator(req.user!.role)) {
        const deptAccount = await prisma.account.findUnique({ where: { departmentId: targetDeptId } });
        const minRequired = 1500;
        if (!deptAccount || deptAccount.balance < minRequired) {
            throw new AppError(`INSUFFICIENT SECTORAL LIQUIDITY: A minimum departmental reserve of ${minRequired} KES is required for all operations (Department or Church funded). Current balance: ${deptAccount?.balance || 0} KES.`, 402);
        }
    }

    const autoApprove = canAutoPublishContent(req.user!.role);
    assertPastorSelection(autoApprove, pastorIds, 'You must select exactly 2 Pastors to authorize this plan.');
    const content = String(description || req.body.content || '').trim();
    if (content.length < 10) {
        throw new AppError('Plan description must be at least 10 characters.', 400);
    }
    const approvalNotice = {
        title: '📜 Plan Authorization Required',
        message: `New strategic plan "${title}" requires your executive approval.`
    };
    let approverIds: string[] = [];

    const plan = await prisma.$transaction(async (tx) => {
        const newPlan = await tx.plan.create({
            data: {
                type, title, content,
                departmentId: targetDeptId,
                budgetSource: (req.body.budgetSource || 'DEPARTMENT') as any,
                isMajor: req.body.isMajor === true,
                approvalStatus: autoApprove ? 'APPROVED' : 'PENDING_APPROVAL',
                status: 'PLANNED',
                createdById: req.user!.id,
            } as any,
        });

        if (!autoApprove) {
            approverIds = await createApprovalChain(tx, 'plan', newPlan.id, pastorIds, approvalNotice);
        }

        return newPlan;
    });

    const user = req.user!;
    await logAudit(user.id, 'CREATE', 'PLAN', plan.id, { title, type }, req.ip, req.get('user-agent'));
    notifyApprovers(approverIds, approvalNotice);

    // Invalidate Cache
    await invalidatePlanCache();

    res.status(201).json(plan);
});

export const approvePlan = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const user = req.user!;

    const planData = await prisma.plan.findFirst({ where: { id, deletedAt: null } });
    if (!planData) throw new AppError('Plan not found', 404);
    assertAwaitingApproval(planData.approvalStatus);

    const { approvals, quorumMet } = await prisma.$transaction(async (tx) => {
        const result = await recordApproval(tx, 'plan', id, user);
        if (result.quorumMet) {
            await tx.plan.update({
                where: { id },
                data: { approvalStatus: 'APPROVED' }
            });
        }
        return result;
    });

    if (quorumMet) {
        await logAudit(user.id, 'PUBLISH', 'PLAN', id, { title: planData.title }, req.ip, req.get('user-agent'));
    }
    await invalidatePlanCache();

    res.json({
        message: quorumMet ? 'Plan approved' : 'Approval recorded',
        totalApprovals: approvals.filter((a) => a.approved).length,
        approvalStatus: quorumMet ? 'APPROVED' : planData.approvalStatus
    });
});

export const updatePlanStatus = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { approvalStatus } = req.body;
    const user = req.user!;

    if (!['APPROVED', 'REJECTED'].includes(approvalStatus)) {
        throw new AppError('Invalid approval status', 400);
    }
    await assertCanSetApprovalStatus(prisma, 'plan', id, user, approvalStatus);

    const plan = await prisma.plan.update({
        where: { id },
        data: { approvalStatus }
    });

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

    const {
        description,
        pastorIds: _pastorIds,
        approvalStatus: _approvalStatus,
        budgetNeeded: _budgetNeeded,
        departmentId,
        ...rest
    } = req.body;

    const canMoveDepartment = isGlobalOperator(user.role) && departmentId && departmentId !== plan.departmentId;
    const updateData = {
        ...rest,
        ...(canMoveDepartment && { departmentId }),
        content: description || req.body.content || plan.content,
    };

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
        if (plan.status !== 'COMPLETED' && plan.status !== 'TACKLED' && plan.approvalStatus !== 'REJECTED') {
            throw new AppError('DELETION RESTRICTED: Plans can only be decommissioned after achievement (COMPLETED/TACKLED).', 403);
        }
    } else if (plan.approvalStatus === 'APPROVED' && user.role !== 'SUPER_ADMIN') {
        throw new AppError('Approved plans require High Authorization to decommission.', 403);
    }

    await prisma.plan.update({
        where: { id: req.params.id },
        data: {
            deletedAt: new Date(),
            deletedBy: user.id,
        },
    });

    logAudit(user.id, 'DELETE', 'PLAN', plan.id, { title: plan.title }, req.ip, req.get('user-agent'));

    void invalidatePlanCache();

    res.json({ message: 'Plan deleted successfully' });
});

/**
 * ⚡ Cache Invalidation Helper
 */
async function invalidatePlanCache() {
    void invalidateCache('plans:*');
}
