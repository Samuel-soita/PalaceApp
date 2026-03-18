import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';
import { getOrSetCache } from '../../utils/redis.js';
import redis from '../../utils/redis.js';

export const getProjects = async (req: Request, res: Response) => {
    try {
        const { departmentId, isMajor, page = '1', limit = '10' } = req.query;
        const user = (req as any).user;
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        const where: any = {};
        if (departmentId) where.departmentId = String(departmentId);
        if (isMajor !== undefined) where.isMajor = isMajor === 'true';

        if (user.role === 'WATUA') {
            // WATUA sees EVERYTHING
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
        }

        const cacheKey = `projects:${user.role}:${user.departmentId || 'none'}:${departmentId || 'all'}:${isMajor || 'any'}:${page}:${limit}`;

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
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch projects' });
    }
};

export const getProjectsByDepartment = async (req: Request, res: Response) => {
    try {
        const projects = await prisma.project.findMany({
            where: { departmentId: req.params.departmentId },
            include: { department: true, updates: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(projects);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch projects' });
    }
};

export const createProject = async (req: Request, res: Response) => {
    const { title, description, departmentId, budget, status, deadline, pastorIds } = req.body;
    const user = (req as any).user;

    const isManaging = user.managedDepartments?.some((d: any) => d.id === departmentId) || user.departmentId === departmentId;
    if (['DEPARTMENT_LEADER', 'PASTOR'].includes(user.role) && !isManaging) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    if (user.role === 'MEMBER') {
        return res.status(403).json({ error: 'Members cannot create projects' });
    }

    if (!pastorIds || !Array.isArray(pastorIds) || pastorIds.length !== 2) {
        return res.status(400).json({ error: 'Exactly 2 Pastors required' });
    }

    try {
        const project = await prisma.project.create({
            data: {
                title,
                description,
                departmentId,
                budget: Number(budget) || 0,
                status: status || 'PLANNED',
                isMajor: req.body.isMajor === true,
                deadline: deadline ? new Date(deadline) : null,
                progress: 0,
                approvalStatus: 'PENDING_APPROVAL',
            },
        });

        await logAudit(user.id, 'CREATE', 'PROJECT', project.id, { title, budget });

        // Invalidate Cache
        const keys = await redis.keys('projects:*');
        if (keys.length > 0) await redis.del(...keys);

        res.status(201).json(project);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to create project' });
    }
};

export const approveProject = async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user;

    if (!['SUPER_ADMIN', 'PASTOR', 'WATUA'].includes(user.role)) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const project = await prisma.project.findUnique({ 
            where: { id },
            include: { department: true }
        });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const existing = await prisma.projectApproval.findUnique({
            where: { projectId_userId: { projectId: id, userId: user.id } }
        });
        if (existing) return res.status(400).json({ error: 'Already approved' });

        await prisma.projectApproval.create({
            data: {
                projectId: id,
                userId: user.id,
                role: user.role === 'SUPER_ADMIN' ? 'BISHOP' : 'PASTOR'
            }
        });

        const allApprovals = await prisma.projectApproval.findMany({ where: { projectId: id } });
        const bishopApproved = allApprovals.some((a: any) => a.role === 'BISHOP');
        const pastorCount = allApprovals.filter((a: any) => a.role === 'PASTOR').length;

        const quorumMet = bishopApproved && pastorCount >= 2;

        if (quorumMet) {
            await prisma.project.update({
                where: { id },
                data: { approvalStatus: 'APPROVED' }
            });

            await logAudit(user.id, 'PUBLISH', 'PROJECT', id, { title: project.title });

            // Invalidate Cache
            const keys = await redis.keys('projects:*');
            if (keys.length > 0) await redis.del(...keys);
        }

        res.json({ message: 'Approval recorded', totalApprovals: allApprovals.length });
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to approve project' });
    }
};

export const updateProject = async (req: Request, res: Response) => {
    const user = (req as any).user;
    try {
        const existingProject = await prisma.project.findUnique({ where: { id: req.params.id } });
        if (!existingProject) return res.status(404).json({ error: 'Project not found' });

        const isManaging = user.managedDepartments?.some((d: any) => d.id === existingProject.departmentId) || user.departmentId === existingProject.departmentId;
        const canUpdate = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY'].includes(user.role) || 
                          (['DEPARTMENT_LEADER', 'PASTOR'].includes(user.role) && isManaging);

        if (!canUpdate) return res.status(403).json({ error: 'Access denied' });

        const { id, departmentId, approvalStatus, createdAt, budget, progress, deadline, ...rest } = req.body;
        const project = await prisma.project.update({
            where: { id: req.params.id },
            data: {
                ...rest,
                ...(budget !== undefined && { budget: Number(budget) }),
                ...(progress !== undefined && { progress: Number(progress) }),
                ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
            },
        });

        await logAudit(user.id, 'UPDATE', 'PROJECT', project.id, rest);

        // Invalidate Cache
        const keys = await redis.keys('projects:*');
        if (keys.length > 0) await redis.del(...keys);

        res.json(project);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to update project' });
    }
};

export const deleteProject = async (req: Request, res: Response) => {
    const user = (req as any).user;
    try {
        const existingProject = await prisma.project.findUnique({ where: { id: req.params.id } });
        if (!existingProject) return res.status(404).json({ error: 'Project not found' });

        if (user.role === 'SECRETARY') return res.status(403).json({ error: 'Secretaries cannot delete church records' });

        const isManaging = user.managedDepartments?.some((d: any) => d.id === existingProject.departmentId) || user.departmentId === existingProject.departmentId;
        const canDelete = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(user.role) || 
                          (['DEPARTMENT_LEADER', 'PASTOR'].includes(user.role) && isManaging);

        if (!canDelete) return res.status(403).json({ error: 'Access denied' });

        await logAudit(user.id, 'DELETE', 'PROJECT', existingProject.id, { title: existingProject.title });
        await prisma.project.delete({ where: { id: req.params.id } });

        // Invalidate Cache
        const keys = await redis.keys('projects:*');
        if (keys.length > 0) await redis.del(...keys);

        res.json({ message: 'Project deleted successfully' });
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to delete project' });
    }
};

export const addProjectUpdate = async (req: Request, res: Response) => {
    const { message } = req.body;
    const { id: projectId } = req.params;
    const user = (req as any).user;

    try {
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const isManaging = user.managedDepartments?.some((d: any) => d.id === project.departmentId) || user.departmentId === project.departmentId;
        if (['DEPARTMENT_LEADER', 'PASTOR'].includes(user.role) && !isManaging) return res.status(403).json({ error: 'Unauthorized' });

        const update = await prisma.projectUpdate.create({
            data: { projectId, message },
        });

        // Invalidate Cache
        const keys = await redis.keys('projects:*');
        if (keys.length > 0) await redis.del(...keys);

        res.status(201).json(update);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to add update' });
    }
};
