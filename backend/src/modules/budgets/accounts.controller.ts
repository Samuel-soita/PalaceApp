import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';

export const getAllAccountSummaries = async (req: AuthRequest, res: Response) => {
    try {
        const accounts = await (prisma as any).account.findMany({
            include: { department: { select: { name: true } } }
        });
        res.json(accounts);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch global accounts' });
    }
};

export const getAccountSummary = async (req: AuthRequest, res: Response) => {
    const { departmentId } = req.params;
    if (!departmentId || departmentId === 'undefined') {
        return res.status(400).json({ error: 'Department ID is required' });
    }
    try {
        let account = await (prisma as any).account.findUnique({
            where: { departmentId },
            include: { department: { select: { name: true } } }
        });

        // Initialize account if it doesn't exist
        if (!account) {
            account = await (prisma as any).account.create({
                data: { departmentId, balance: 0, totalIncome: 0, totalExpenditure: 0 },
                include: { department: { select: { name: true } } }
            });
        }

        res.json(account);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch account summary' });
    }
};

export const getTransactions = async (req: AuthRequest, res: Response) => {
    const { departmentId } = req.params;
    if (!departmentId || departmentId === 'undefined') {
        return res.status(400).json({ error: 'Department ID is required' });
    }
    try {
        const account = await (prisma as any).account.findUnique({ where: { departmentId } });
        if (!account) return res.json([]);

        const transactions = await (prisma as any).transaction.findMany({
            where: { accountId: account.id },
            include: { 
                requester: { select: { name: true } },
                approver: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(transactions);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch transactions' });
    }
};

export const createTransaction = async (req: AuthRequest, res: Response) => {
    const { departmentId, type, amount, description } = req.body;
    try {
        const account = await (prisma as any).account.findUnique({ where: { departmentId } });
        if (!account) return res.status(404).json({ error: 'Account not found' });

        const transaction = await (prisma as any).transaction.create({
            data: {
                accountId: account.id,
                type,
                amount,
                description,
                status: 'PENDING',
                requestedById: req.user!.id
            }
        });

        await logAudit(req.user!.id, 'CREATE_TRANSACTION', 'TRANSACTION', transaction.id, { type, amount });
        res.status(201).json(transaction);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to create transaction' });
    }
};

export const approveTransaction = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body; // APPROVED or REJECTED
    try {
        const transaction = await (prisma as any).transaction.findUnique({
            where: { id },
            include: { account: true }
        });

        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
        if (transaction.status !== 'PENDING') return res.status(400).json({ error: 'Transaction already processed' });

        const updatedTransaction = await (prisma as any).transaction.update({
            where: { id },
            data: { 
                status,
                approvedById: req.user!.id
            }
        });

        if (status === 'APPROVED') {
            const isIncome = transaction.type === 'INCOME';
            await (prisma as any).account.update({
                where: { id: transaction.accountId },
                data: {
                    balance: { [isIncome ? 'increment' : 'decrement']: transaction.amount },
                    [isIncome ? 'totalIncome' : 'totalExpenditure']: { increment: transaction.amount }
                }
            });
        }

        await logAudit(req.user!.id, 'APPROVE_TRANSACTION', 'TRANSACTION', id, { status });
        res.json(updatedTransaction);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to process transaction' });
    }
};
