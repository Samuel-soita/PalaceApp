import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';
import { getOrSetCache } from '../../utils/redis.js';
import redis from '../../utils/redis.js';

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

        // Invalidate Cache
        const keys = await redis.keys('budgets:*');
        if (keys.length > 0) await redis.del(...keys);

        res.status(201).json(budget);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to create budget' });
    }
};

export const getBudgets = async (req: Request, res: Response) => {
    try {
        const { departmentId, page = '1', limit = '10' } = req.query;
        const user = (req as any).user;
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        const where: any = departmentId ? { departmentId: String(departmentId) } : {};

        const cacheKey = `budgets:${user?.role || 'none'}:${departmentId || 'all'}:${page}:${limit}`;

        const result = await getOrSetCache(cacheKey, async () => {
            const [data, total] = await Promise.all([
                prisma.budget.findMany({
                    where,
                    include: {
                        department: { select: { name: true } },
                        contributors: true,
                        _count: { select: { contributors: true } }
                    },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take,
                }),
                prisma.budget.count({ where })
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
        res.status(500).json({ error: error.message || 'Failed to fetch budgets' });
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

        // Invalidate Cache
        const keys = await redis.keys('budgets:*');
        if (keys.length > 0) await redis.del(...keys);

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

        // Invalidate Cache
        const keys = await redis.keys('budgets:*');
        if (keys.length > 0) await redis.del(...keys);

        res.json({ message: 'Budget deleted successfully' });
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to delete budget' });
    }
};

/**
 * 2.4.0 Kernel: Unified Financial Ledger Binding.
 * All budget contributions must flow into the department's actual Account.
 */
export const fundBudget = async (req: any, res: Response) => {
    const { id: budgetId } = req.params;
    const { amount, referenceCode } = req.body;
    const actorId = req.user.id;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Contribution amount must be strictly positive.' });
    }

    try {
        const budget = await prisma.budget.findUnique({ where: { id: budgetId } });
        if (!budget) return res.status(404).json({ error: 'Budget not found.' });

        const result = await prisma.$transaction(async (tx) => {
            // 1. Record the contribution
            const contribution = await tx.budgetContributor.create({
                data: {
                    budgetId,
                    userId: actorId,
                    amount: Number(amount)
                }
            });

            // 2. Fund the Department Account directly (Unified Ledger)
            const account = await tx.account.upsert({
                where: { departmentId: budget.departmentId },
                update: { balance: { increment: Number(amount) }, totalIncome: { increment: Number(amount) } },
                create: { departmentId: budget.departmentId, balance: Number(amount), totalIncome: Number(amount) }
            });

            // 3. Record the Transaction
            const transaction = await tx.transaction.create({
                data: {
                    accountId: account.id,
                    type: 'INCOME',
                    amount: Number(amount),
                    description: `Budget Funding: ${budget.title} [Ref: ${referenceCode || 'CASH'}]`,
                    status: 'APPROVED',
                    requestedById: actorId
                }
            });

            return { contribution, transaction };
        });

        // Invalidate Cache
        const keys = await redis.keys('budgets:*');
        if (keys.length > 0) await redis.del(...keys);

        res.status(201).json({ 
            message: 'Budget funded successfully. Funds transferred to Department Account.',
            data: result.contribution
        });
    } catch (error: any) {
        console.error('[BUDGET_FUNDING_ERROR]', error);
        res.status(500).json({ error: 'System failed to process budget funding.' });
    }
};
