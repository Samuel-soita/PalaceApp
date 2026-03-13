import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';

export const getProjects = async (req: Request, res: Response) => {
    try {
        const { departmentId } = req.query;
        const projects = await prisma.project.findMany({
            where: departmentId ? { departmentId: String(departmentId) } : {},
            include: { department: true, updates: true },
            // @ts-ignore
            orderBy: { deadline: 'asc' },
        });
        res.json(projects);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch projects' });
    }
};

export const getProjectsByDepartment = async (req: Request, res: Response) => {
    try {
        const projects = await prisma.project.findMany({
            where: { departmentId: req.params.departmentId },
            include: { department: true, updates: true },
            // @ts-ignore
            orderBy: { deadline: 'asc' },
        });
        res.json(projects);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch projects' });
    }
};

export const createProject = async (req: Request, res: Response) => {
    const { title, description, departmentId, budget, status, deadline, pastorIds } = req.body;
    const user = (req as any).user;

    // RBAC: Only SUPER_ADMIN or DEPARTMENT_LEADER can create.
    if (user.role === 'DEPARTMENT_LEADER' && user.departmentId !== departmentId) {
        return res.status(403).json({ error: 'Unauthorized: You can only create projects for your own department' });
    }

    // Must pick exactly 2 pastors
    if (!pastorIds || !Array.isArray(pastorIds) || pastorIds.length !== 2) {
        return res.status(400).json({ error: 'You must select exactly 2 Pastors to approve this project.' });
    }

    try {
        const project = await prisma.project.create({
            data: {
                title,
                description,
                departmentId,
                budget: Number(budget) || 0,
                status: status || 'PLANNED',
                // @ts-ignore
                deadline: deadline ? new Date(deadline) : null,
                progress: 0,
                // @ts-ignore
                approvalStatus: 'PENDING_APPROVAL',
            },
        });

        // Notify Bishop and the 2 assigned Pastors
        const bishop = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
        
        const notifications = [];
        if (bishop) {
            notifications.push({
                userId: bishop.id,
                title: '📋 Project Awaiting Approval',
                message: `Project "${title}" requires your authorization.`
            });
        }
        
        for (const pastorId of pastorIds) {
            notifications.push({
                userId: pastorId,
                title: '📋 Project Awaiting Your Signature',
                message: `You were selected to review Project "${title}".`
            });
        }

        if (notifications.length > 0) {
            await prisma.notification.createMany({ data: notifications });
        }

        res.status(201).json(project);
    } catch (error: any) {
        console.error('[createProject]', error);
        res.status(400).json({ error: error.message || 'Failed to create project' });
    }
};

// 3-sig quorum: 1 Bishop + 2 Pastors
export const approveProject = async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user;

    if (!['SUPER_ADMIN', 'PASTOR'].includes(user.role)) {
        return res.status(403).json({ error: 'Only the Bishop or Pastors can approve projects.' });
    }

    try {
        const project = await prisma.project.findUnique({ 
            where: { id },
            include: { department: true }
        });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Check if already approved
        // @ts-ignore
        const existing = await prisma.projectApproval.findUnique({
            where: { projectId_userId: { projectId: id, userId: user.id } }
        });
        if (existing) return res.status(400).json({ error: 'You have already approved this project.' });

        // Record approval
        // @ts-ignore
        await prisma.projectApproval.create({
            data: {
                projectId: id,
                userId: user.id,
                role: user.role === 'SUPER_ADMIN' ? 'BISHOP' : 'PASTOR'
            }
        });

        // Get all approvals
        // @ts-ignore
        const allApprovals = await prisma.projectApproval.findMany({ where: { projectId: id } });
        const bishopApproved = allApprovals.some((a: any) => a.role === 'BISHOP');
        const pastorCount = allApprovals.filter((a: any) => a.role === 'PASTOR').length;

        // If quorum met: Publish
        if (bishopApproved && pastorCount >= 2) {
            await prisma.project.update({
                where: { id },
                // @ts-ignore
                data: { approvalStatus: 'APPROVED' }
            });

            // Notify Department Leaders
            const leaders = await prisma.user.findMany({
                where: { role: 'DEPARTMENT_LEADER' }
            });
            await prisma.notification.createMany({
                data: leaders.map(l => ({
                    userId: l.id,
                    title: '✅ Project Approved',
                    message: `Project "${project.title}" from the ${project.department.name} department is now approved and live!`
                }))
            });
        }

        res.json({ message: 'Approval recorded.', totalApprovals: allApprovals.length });
    } catch (error: any) {
        console.error('[approveProject]', error);
        res.status(400).json({ error: error.message || 'Failed to approve project' });
    }
};

export const updateProject = async (req: Request, res: Response) => {
    const user = (req as any).user;
    try {
        const existingProject = await prisma.project.findUnique({ where: { id: req.params.id } });
        if (!existingProject) return res.status(404).json({ error: 'Project not found' });

        if (user.role === 'DEPARTMENT_LEADER' && user.departmentId !== existingProject.departmentId) {
            return res.status(403).json({ error: 'Unauthorized: You can only update projects for your own department' });
        }

        const { budget, progress, deadline, ...rest } = req.body;
        const project = await prisma.project.update({
            where: { id: req.params.id },
            data: {
                ...rest,
                ...(budget !== undefined && { budget: Number(budget) }),
                ...(progress !== undefined && { progress: Number(progress) }),
                // @ts-ignore
                ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
            },
        });
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

        if (user.role === 'DEPARTMENT_LEADER' && user.departmentId !== existingProject.departmentId) {
            return res.status(403).json({ error: 'Unauthorized: You can only delete projects for your own department' });
        }

        await prisma.project.delete({ where: { id: req.params.id } });
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

        if (user.role === 'DEPARTMENT_LEADER' && user.departmentId !== project.departmentId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const update = await prisma.projectUpdate.create({
            data: {
                projectId,
                message,
            },
        });
        res.status(201).json(update);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to add project update' });
    }
};
