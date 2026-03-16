import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';

export const createBudget = async (req: any, res: Response) => {
    const { title, targetAmount, deadline, departmentId, linkedEventId } = req.body;

    try {
        const budget = await prisma.budget.create({
            data: {
                title,
                targetAmount,
                deadline: new Date(deadline),
                departmentId,
                linkedEventId,
            },
        });
        
        if (req.user) {
            await logAudit(req.user.id, 'CREATE', 'BUDGET', budget.id, { title, targetAmount });
        }

        res.status(201).json(budget);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to create budget' });
    }
};

export const getBudgets = async (req: Request, res: Response) => {
    const { departmentId } = req.query;
    try {
        const budgets = await prisma.budget.findMany({
            where: departmentId ? { departmentId: String(departmentId) } : {},
            include: {
                department: { select: { name: true } },
                contributors: true,
                _count: { select: { contributors: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(budgets);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch budgets' });
    }
};
export const updateBudget = async (req: any, res: Response) => {
    try {
        const budget = await prisma.budget.update({
            where: { id: req.params.id },
            data: {
                ...req.body,
                deadline: req.body.deadline ? new Date(req.body.deadline) : undefined,
            },
        });

        if (req.user) {
            await logAudit(req.user.id, 'UPDATE', 'BUDGET', budget.id, req.body);
        }

        res.json(budget);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to update budget' });
    }
};

export const deleteBudget = async (req: any, res: Response) => {
    try {
        const budget = await prisma.budget.findUnique({ where: { id: req.params.id } });
        
        if (!budget) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        if (req.user) {
            await logAudit(req.user.id, 'DELETE', 'BUDGET', budget.id, { title: budget.title });
        }

        await prisma.budget.delete({ where: { id: req.params.id } });
        res.json({ message: 'Budget deleted successfully' });
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to delete budget' });
    }
};
