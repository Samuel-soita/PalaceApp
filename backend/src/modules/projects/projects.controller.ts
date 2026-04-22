import { Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';
import { getOrSetCache } from '../../utils/redis.js';
import redis from '../../utils/redis.js';
import { catchAsync, AppError } from '../../utils/errors.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';

/**
 * 🔍 Fetch Projects with multi-role visibility scoping
 */
export const getProjects = catchAsync(async (req: AuthRequest, res: Response) => {
    const { departmentId, isMajor, page = '1', limit = '10' } = req.query;
    const user = req.user!;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = { deletedAt: null }; 
    if (departmentId) where.departmentId = String(departmentId);
    
    // Visibility logic will handle isMajor within OR blocks for non-admins
    if (user.role === 'WATUA' && isMajor !== undefined) {
        where.isMajor = isMajor === 'true';
    }

    // RBAC-BASED VISIBILITY SCOPING
    if (user.role === 'WATUA' || user.role === 'SUPER_ADMIN') {
        // Unrestricted view
    } else if (user.role === 'MEMBER') {
        where.approvalStatus = 'APPROVED';
        where.OR = [
            { isMajor: true },
            ...(user.departmentId ? [{ departmentId: user.departmentId }] : [])
        ];
    } else {
        // PASTOR / DEPT_LEADER Scoping
        const managedDeptIds = user.managedDepartments?.map((d: any) => d.id) || [];
        if (user.departmentId) managedDeptIds.push(user.departmentId);

        if (!departmentId) {
            where.OR = [
                { departmentId: { in: managedDeptIds } },
                { approvalStatus: 'APPROVED', isMajor: true }
            ];
        } else if (!managedDeptIds.includes(String(departmentId))) {
            where.approvalStatus = 'APPROVED';
        }
    }

    const cacheKey = `projects:v2:${user.role}:${user.departmentId || 'none'}:${departmentId || 'all'}:${isMajor || 'any'}:${page}:${limit}`;

    const result = await getOrSetCache(cacheKey, async () => {
        const [data, total] = await Promise.all([
            prisma.project.findMany({
                where,
                include: { department: true, updates: true },
                orderBy: { createdAt: 'desc' },
                skip,
                take,
            }),
            prisma.project.count({ where })
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

/**
 * 🏢 Fetch Projects for a specific department (Guarded)
 */
export const getProjectsByDepartment = catchAsync(async (req: AuthRequest, res: Response) => {
    const projects = await prisma.project.findMany({
        where: { 
            departmentId: req.params.departmentId,
            deletedAt: null 
        },
        include: { department: true, updates: true },
        orderBy: { createdAt: 'desc' },
    });
    res.json(projects);
});

/**
 * 🔎 Fetch Single Project by ID
 */
export const getProjectById = catchAsync(async (req: AuthRequest, res: Response) => {
    const project = await prisma.project.findFirst({
        where: { id: req.params.id, deletedAt: null },
        include: { department: true, updates: true }
    });

    if (!project) throw new AppError('Project not found or has been decommissioned.', 404);
    res.json(project);
});

/**
 * 🛠️ Create New Project
 */
export const createProject = catchAsync(async (req: AuthRequest, res: Response) => {
    const { title, description, departmentId, budget, budgetSource = 'DEPARTMENT', status, deadline, category, pastorIds, isMajor } = req.body;
    const user = req.user!;

    if (user.role === 'DEPARTMENT_LEADER') {
        const isManaging = user.managedDepartments?.some((d: any) => d.id === departmentId) || user.departmentId === departmentId;
        if (!isManaging) {
            throw new AppError('Leaders can only create projects for their own department', 403);
        }
    }

    const targetDeptId = departmentId || user.departmentId;

    // ─── Universal Financial Safeguard (Mandatory 1,500 KES Floor) ───
    const deptAccount = await prisma.account.findUnique({ where: { departmentId: targetDeptId } });
    const minRequired = 1500;
    if (!deptAccount || deptAccount.balance < minRequired) {
        throw new AppError(`INSUFFICIENT SECTORAL LIQUIDITY: A minimum departmental reserve of ${minRequired} KES is required for all operations (Department or Church funded). Current balance: ${deptAccount?.balance || 0} KES.`, 402);
    }

    const project = await prisma.$transaction(async (tx) => {
        const newProject = await tx.project.create({
            data: {
                title,
                description,
                departmentId: targetDeptId,
                budget: Number(budget) || 0,
                budgetSource: budgetSource as any,
                status: status || 'PLANNED',
                isMajor: isMajor === true,
                deadline: deadline ? new Date(deadline) : null,
                progress: 0,
                approvalStatus: 'PENDING_APPROVAL',
                category: category || 'NEW_PROJECT',
                createdById: user.id,
                targetPastorId: (pastorIds && pastorIds.length > 0) ? pastorIds[0] : null
            } as any,
        });

        // ─── Automated Tactical Broadcast ───
        await tx.announcement.create({
            data: {
                title: `NEW PROJECT: ${title.toUpperCase()}`,
                content: `Strategic project initiated: ${description.substring(0, 100)}...`,
                priority: 'NORMAL',
                isGlobal: !!isMajor,
                isMajor: !!isMajor,
                status: 'PENDING',
                eventDate: deadline ? new Date(deadline) : new Date(),
                location: 'CHURCH GROUNDS',
                authorId: user.id,
                departmentId: targetDeptId,
                projectId: newProject.id
            } as any
        });

        // 👨‍⚖️ Initializing Approval Chain
        const approvalData: any[] = (pastorIds || []).map((pid: string) => ({
            projectId: newProject.id,
            userId: pid,
            role: 'PASTOR',
            approved: false
        }));

        const bishop = await tx.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
        if (bishop && !pastorIds?.includes(bishop.id)) {
            approvalData.push({
                projectId: newProject.id,
                userId: bishop.id,
                role: 'SUPER_ADMIN',
                approved: false
            });
        }

        if (approvalData.length > 0) {
            await tx.projectApproval.createMany({ data: approvalData });
            
            const notifications = approvalData.map((app: any) => ({
                userId: app.userId,
                title: '📋 Project Clearance Required',
                message: `Project "${title}" requires your strategic authorization.`
            }));
            await tx.notification.createMany({ data: notifications });
        }

        return newProject;
    });

    await logAudit(user.id, 'CREATE', 'PROJECT', project.id, { title, budget }, req.ip, req.get('user-agent'));
    await invalidateProjectCache();

    res.status(201).json(project);
});

/**
 * ✅ Approve Project (Multi-signature logic)
 */
export const approveProject = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const user = req.user!;

    const project = await prisma.project.findFirst({ 
        where: { id, deletedAt: null } 
    });
    if (!project) throw new AppError('Project not found', 404);

    const existingApproval = await prisma.projectApproval.findFirst({
        where: { projectId: id, userId: user.id }
    });
    
    if (!existingApproval && !['SUPER_ADMIN', 'WATUA'].includes(user.role)) {
        throw new AppError('You are not authorized to approve this project mission.', 403);
    }
    
    if (existingApproval && existingApproval.approved) throw new AppError('You have already signed off on this project.', 400);

    // Recording approval in a transaction to ensure integrity
    await prisma.$transaction(async (tx) => {
        await tx.projectApproval.upsert({
            where: { projectId_userId: { projectId: id, userId: user.id } },
            update: { approved: true },
            create: {
                projectId: id,
                userId: user.id,
                role: user.role === 'SUPER_ADMIN' ? 'BISHOP' : (['PASTOR', 'ASSOCIATE_PASTOR'].includes(user.role) ? 'PASTOR' : user.role),
                approved: true
            }
        });

        const allApprovals = await tx.projectApproval.findMany({ where: { projectId: id } });
        const bishopApproved = allApprovals.some((a: any) => a.role === 'BISHOP' && a.approved);
        const pastorCount = allApprovals.filter((a: any) => a.role === 'PASTOR' && a.approved).length;

        if (bishopApproved && pastorCount >= 2) {
            await tx.project.update({
                where: { id },
                data: { approvalStatus: 'APPROVED' }
            });

            // 📢 AUTOMATED BROADCAST PUBLISHING
            await tx.announcement.updateMany({
                where: { projectId: id, status: 'PENDING' },
                data: { status: 'PUBLISHED' }
            });

            await logAudit(user.id, 'PUBLISH', 'PROJECT', id, { title: project.title }, req.ip, req.get('user-agent'));
        }
    });

    await invalidateProjectCache();
    res.json({ message: 'Approval recorded successfully.' });
});

/**
 * ✅ Force Approve Project Status (Intervention)
 */
export const updateProjectStatus = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { approvalStatus } = req.body;
    const user = req.user!;

    if (!['APPROVED', 'REJECTED'].includes(approvalStatus)) {
        throw new AppError('Invalid approval status', 400);
    }

    const project = await prisma.project.update({
        where: { id },
        data: { approvalStatus }
    });

    await logAudit(user.id, 'FORCE_APPROVE', 'PROJECT', id, { title: project.title, approvalStatus }, req.ip, req.get('user-agent'));
    await invalidateProjectCache();

    res.json({ message: `Project status forcefully updated to ${approvalStatus}`, project });
});

/**
 * 📝 Update Project
 */
export const updateProject = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { budget, progress, deadline, ...rest } = req.body;
    const user = req.user!;

    const existingProject = await prisma.project.findFirst({ where: { id, deletedAt: null } });
    if (!existingProject) throw new AppError('Project not found', 404);

    if (user.role === 'DEPARTMENT_LEADER') {
        const isManaging = user.managedDepartments?.some((d: any) => d.id === existingProject.departmentId) || user.departmentId === existingProject.departmentId;
        if (!isManaging) {
            throw new AppError('Leaders can only update projects for their own department', 403);
        }
    }

    if (existingProject.approvalStatus === 'APPROVED' && user.role === 'DEPARTMENT_LEADER') {
        throw new AppError('OPERATIONAL LOCK: Approved projects are frozen. De-authorization from Bishop is required for modifications.', 403);
    }

    // ─── Universal Financial Safeguard on Update ───
    const deptAccount = await prisma.account.findUnique({ where: { departmentId: existingProject.departmentId } });
    if (!deptAccount || deptAccount.balance < 1500) {
        throw new AppError('INSUFFICIENT SECTORAL LIQUIDITY: A minimum departmental reserve of 1,500 KES is required for all operations.', 402);
    }

    // Sanitizing payload and handling numeric/date fields
    const { pastorIds, ...cleanRest } = req.body;
    
    const project = await prisma.project.update({
        where: { id: id },
        data: {
            ...rest,
            ...(budget !== undefined && { budget: Number(budget) }),
            ...(progress !== undefined && { progress: Number(progress) }),
            ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
        },
    });

    await logAudit(user.id, 'UPDATE', 'PROJECT', project.id, cleanRest, req.ip, req.get('user-agent'));
    await invalidateProjectCache();

    res.json(project);
});

/**
 * 🗑️ Soft Delete Project
 */
export const deleteProject = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const user = req.user!;

    const existingProject = await prisma.project.findFirst({ where: { id, deletedAt: null } });
    if (!existingProject) throw new AppError('Project not found', 404);

    if (user.role === 'DEPARTMENT_LEADER') {
        if (existingProject.status !== 'COMPLETED' && existingProject.status !== 'TACKLED' && existingProject.status !== 'REJECTED') {
            throw new AppError('DELETION RESTRICTED: Projects can only be decommissioned after achievement (COMPLETED/TACKLED).', 403);
        }
    } else if (existingProject.approvalStatus === 'APPROVED' && user.role !== 'SUPER_ADMIN') {
        throw new AppError('Approved projects require High Authorization (Bishop) to decommission.', 403);
    }

    // Standardized Soft Delete
    await prisma.project.update({
        where: { id },
        data: { 
            deletedAt: new Date(),
            deletedBy: user.id,
            deletedReason: req.body.reason || 'Decommissioned by authorized personnel'
        }
    });

    await logAudit(user.id, 'DELETE', 'PROJECT', id, { title: existingProject.title }, req.ip, req.get('user-agent'));
    await invalidateProjectCache();

    res.json({ message: 'Project successfully decommissioned (Soft-Delete).' });
});

/**
 * 💬 Add Project Update
 */
export const addProjectUpdate = catchAsync(async (req: AuthRequest, res: Response) => {
    const { content, status } = req.body;
    const { id: projectId } = req.params;
    const user = req.user!;

    const project = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } });
    if (!project) throw new AppError('Project not found', 404);
    
    if (user.role === 'DEPARTMENT_LEADER') {
        const isManaging = user.managedDepartments?.some((d: any) => d.id === project.departmentId) || user.departmentId === project.departmentId;
        if (!isManaging) {
            throw new AppError('Access denied: You cannot add updates to an external project.', 403);
        }
    }

    const update = await prisma.$transaction(async (tx) => {
        const up = await tx.projectUpdate.create({
            data: { projectId, message: content },
        });

        if (status) {
            await tx.project.update({
                where: { id: projectId },
                data: { status }
            });
        }
        return up;
    });

    await invalidateProjectCache();
    res.status(201).json(update);
});

/**
 * ⚡ Cache Invalidation Helper
 */
async function invalidateProjectCache() {
    const keys = await redis.keys('projects:*');
    if (keys.length > 0) await redis.del(...keys);
}
