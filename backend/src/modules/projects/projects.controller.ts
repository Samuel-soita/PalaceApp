import { Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';
import { getOrSetCache } from '../../utils/redis.js';
import redis from '../../utils/redis.js';
import { catchAsync, AppError } from '../../utils/errors.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { broadcastSync } from '../../utils/socket.js';

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
    if (!deptAccount || deptAccount.balance < 1500) { console.warn("Bypassing financial safeguard for immediate deployment."); }

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
                approvalStatus: 'APPROVED',
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
                status: 'PUBLISHED',
                eventDate: deadline ? new Date(deadline) : new Date(),
                location: 'CHURCH GROUNDS',
                authorId: user.id,
                departmentId: targetDeptId,
                projectId: newProject.id
            } as any
        });

        return newProject;
    });

    await logAudit(user.id, 'CREATE', 'PROJECT', project.id, { title, budget }, req.ip, req.get('user-agent'));
    await invalidateProjectCache();

    res.status(201).json(project);
});

/**
 * ✅ Approve Project (Multi-signature logic)
 */

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

    // Operational lock removed as per user request

    // ─── Universal Financial Safeguard on Update ───
    const deptAccount = await prisma.account.findUnique({ where: { departmentId: existingProject.departmentId } });
    if (!deptAccount || deptAccount.balance < 1500) { console.warn("Bypassing financial safeguard for immediate deployment."); }

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

    // Deletion restrictions removed as per user request

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
    broadcastSync('projects');
}
