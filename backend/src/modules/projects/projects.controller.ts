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

    const where: any = { deletedAt: null }; // GLOBAL EXCLUSION OF SOFT-DELETED RECORDS
    if (departmentId) where.departmentId = String(departmentId);
    if (isMajor !== undefined) where.isMajor = isMajor === 'true';

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
    const { title, description, departmentId, budget, status, deadline, category, pastorIds, isMajor } = req.body;
    const user = req.user!;

    if (user.role === 'DEPARTMENT_LEADER') {
        const isManaging = user.managedDepartments?.some((d: any) => d.id === departmentId) || user.departmentId === departmentId;
        if (!isManaging) {
            throw new AppError('Leaders can only create projects for their own department', 403);
        }
    }

    const project = await prisma.$transaction(async (tx) => {
        const p = await tx.project.create({
            data: {
                title,
                description,
                departmentId,
                budget: Number(budget) || 0,
                status: status || 'PLANNED',
                isMajor: isMajor === true,
                deadline: deadline ? new Date(deadline) : null,
                progress: 0,
                approvalStatus: 'PENDING_APPROVAL',
                category: category || 'NEW_PROJECT',
            },
        });

        // 👨‍⚖️ Initializing Approval Chain
        const approvalData: any[] = (pastorIds || []).map((pid: string) => ({
            projectId: p.id,
            userId: pid,
            role: 'PASTOR'
        }));

        const bishop = await tx.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
        if (bishop) {
            approvalData.push({
                projectId: p.id,
                userId: bishop.id,
                role: 'SUPER_ADMIN'
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
        
        return p;
    });

    await logAudit(user.id, 'CREATE', 'PROJECT', project.id, { title, budget });
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

    const existing = await prisma.projectApproval.findUnique({
        where: { projectId_userId: { projectId: id, userId: user.id } }
    });
    if (existing) throw new AppError('You have already signed off on this project.', 400);

    // Recording approval in a transaction to ensure integrity
    await prisma.$transaction(async (tx) => {
        await tx.projectApproval.create({
            data: {
                projectId: id,
                userId: user.id,
                role: user.role === 'SUPER_ADMIN' ? 'BISHOP' : 'PASTOR'
            }
        });

        const allApprovals = await tx.projectApproval.findMany({ where: { projectId: id } });
        const bishopApproved = allApprovals.some((a: any) => a.role === 'BISHOP');
        const pastorCount = allApprovals.filter((a: any) => a.role === 'PASTOR').length;

        if (bishopApproved && pastorCount >= 2) {
            await tx.project.update({
                where: { id },
                data: { approvalStatus: 'APPROVED' }
            });
            await logAudit(user.id, 'PUBLISH', 'PROJECT', id, { title: project.title });
        }
    });

    await invalidateProjectCache();
    res.json({ message: 'Approval recorded successfully.' });
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

    if (existingProject.approvalStatus === 'APPROVED' && user.role !== 'SUPER_ADMIN') {
        throw new AppError('Approved projects are locked and cannot be modified.', 403);
    }

    const project = await prisma.project.update({
        where: { id },
        data: {
            ...rest,
            ...(budget !== undefined && { budget: Number(budget) }),
            ...(progress !== undefined && { progress: Number(progress) }),
            ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
        },
    });

    await logAudit(user.id, 'UPDATE', 'PROJECT', project.id, rest);
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

    if (existingProject.approvalStatus === 'APPROVED' && user.role !== 'SUPER_ADMIN') {
        throw new AppError('Approved projects are locked and cannot be deleted.', 403);
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

    await logAudit(user.id, 'DELETE', 'PROJECT', id, { title: existingProject.title });
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
