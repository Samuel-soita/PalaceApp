import { Response } from 'express';
import prisma from '../../utils/prisma.js';
import { TelemetryEngine } from '../../utils/health.service.js';

export const recordManualIncome = async (req: any, res: Response) => {
    try {
        const { id: userId, role, departmentId: userDeptId } = req.user;
        const { amount, description, departmentId } = req.body;

        const isAdmin = ['SUPER_ADMIN', 'WATUA', 'SYSTEM_ADMIN'].includes(role);
        const targetDeptId = (isAdmin && departmentId) ? departmentId : userDeptId;

        if (!targetDeptId) {
            return res.status(400).json({ error: 'Department ID is required for income recording.' });
        }

        // Bishop, Watua, and Department Leaders only
        const isLeader = role === 'DEPARTMENT_LEADER' && userDeptId === targetDeptId;
        if (!isAdmin && !isLeader) {
            return res.status(403).json({ error: 'Permission denied: Only Department Leaders or Global Admin can record income.' });
        }

        const transaction = await prisma.$transaction(async (tx) => {
            const account = await tx.account.upsert({
                where: { departmentId: targetDeptId },
                update: {
                    balance: { increment: Number(amount) },
                    totalIncome: { increment: Number(amount) }
                },
                create: {
                    departmentId: targetDeptId,
                    balance: Number(amount),
                    totalIncome: Number(amount)
                }
            });

            return tx.transaction.create({
                data: {
                    accountId: account.id,
                    type: 'INCOME',
                    amount: Number(amount),
                    description,
                    status: 'APPROVED',
                    requestedById: userId
                }
            });
        });

        res.json({ message: 'Income recorded successfully.', transaction });
    } catch (error: any) {
        console.error('Record Income Error:', error);
        res.status(500).json({ error: 'Failed to record income.' });
    }
};

export const getAllAccountSummaries = async (req: any, res: Response) => {
    try {
        const accounts = await prisma.account.findMany({
            include: { department: { select: { name: true } } }
        });
        res.json(accounts);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch global ledgers' });
    }
};

export const getAccountSummary = async (req: any, res: Response) => {
    const { departmentId } = req.params;
    if (!departmentId || departmentId === 'undefined') {
        return res.status(400).json({ error: 'Department ID is required' });
    }
    try {
        let account = await prisma.account.findUnique({
            where: { departmentId },
            include: { department: { select: { name: true } } }
        });

        // Initialize account if it doesn't exist
        if (!account) {
            account = await prisma.account.create({
                data: { departmentId, balance: 0, totalIncome: 0, totalExpenditure: 0 },
                include: { department: { select: { name: true } } }
            });
        }

        res.json(account);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch ledger summary' });
    }
};

export const getTransactions = async (req: any, res: Response) => {
    const { departmentId } = req.params;
    if (!departmentId || departmentId === 'undefined') {
        return res.status(400).json({ error: 'Department ID is required' });
    }
    try {
        const account = await prisma.account.findUnique({ where: { departmentId } });
        if (!account) return res.json([]);

        const transactions = await prisma.transaction.findMany({
            where: { accountId: account.id },
            include: { 
                requester: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(transactions);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch transaction stream' });
    }
};

export const requestWithdrawal = async (req: any, res: Response) => {
    try {
        const { id: userId, role, departmentId: userDeptId } = req.user;
        const { amount, description, departmentId } = req.body;

        const targetDeptId = departmentId || userDeptId;
        if (!targetDeptId) {
            return res.status(400).json({ error: 'Department ID is required for withdrawals.' });
        }

        // Leader, Bishop, Watua can initiate
        const isAdmin = ['SUPER_ADMIN', 'WATUA'].includes(role);
        const isLeader = role === 'DEPARTMENT_LEADER' && userDeptId === targetDeptId;

        if (!isAdmin && !isLeader) {
            return res.status(403).json({ error: 'Permission denied: Only authorized leaders can request withdrawals.' });
        }

        const account = await prisma.account.findUnique({ where: { departmentId: targetDeptId } });
        if (!account || account.balance < Number(amount)) {
            return res.status(400).json({ error: 'Insufficient funds in departmental account.' });
        }

        const transaction = await prisma.transaction.create({
            data: {
                accountId: account.id,
                type: 'WITHDRAWAL',
                amount: Number(amount),
                description,
                status: 'PENDING_LEADER_APPROVAL',
                requestedById: userId
            }
        });

        res.json({ message: 'Withdrawal request submitted. Awaiting tripartite signatures.', transaction });
    } catch (error) {
        console.error('Request Withdrawal Error:', error);
        res.status(500).json({ error: 'Failed to request withdrawal.' });
    }
};

export const approveTransaction = async (req: any, res: Response) => {
    try {
        const { id: userId, role } = req.user;
        const { id: transactionId } = req.params;

        const transaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: { account: true, approvals: true }
        });

        if (!transaction) return res.status(404).json({ error: 'Transaction not found.' });

        // Authorization check for signature roles
        const isBishop = role === 'SUPER_ADMIN';
        const isWatua = role === 'WATUA';
        const isLeader = role === 'DEPARTMENT_LEADER';

        if (!isBishop && !isWatua && !isLeader) {
            return res.status(403).json({ error: 'Only Bishop, Leaders, or Watua can sign withdrawals.' });
        }

        // Prevent double signature from the same user
        const existingSign = transaction.approvals.find(a => a.userId === userId);
        if (existingSign) return res.status(400).json({ error: 'You have already signed this transaction.' });

        const result = await prisma.$transaction(async (tx) => {
            // 1. Record the approval
            await tx.transactionApproval.create({
                data: {
                    transactionId,
                    userId,
                    role,
                    approved: true
                }
            });

            // 2. Determine new status
            const updatedTransaction = await tx.transaction.findUnique({
                where: { id: transactionId },
                include: { approvals: true }
            });

            const approvals = updatedTransaction?.approvals || [];
            const hasLeader = approvals.some(a => a.role === 'DEPARTMENT_LEADER');
            const hasBishop = approvals.some(a => a.role === 'SUPER_ADMIN');
            const hasWatua = approvals.some(a => a.role === 'WATUA');

            let newStatus = transaction.status;
            if (!hasLeader) newStatus = 'PENDING_LEADER_APPROVAL';
            else if (!hasBishop) newStatus = 'PENDING_BISHOP_APPROVAL';
            else if (!hasWatua) newStatus = 'PENDING_WATUA_APPROVAL';
            else newStatus = 'APPROVED';

            // 3. If APPROVED, deduct from account
            if (newStatus === 'APPROVED') {
                await tx.account.update({
                    where: { id: transaction.accountId },
                    data: {
                        balance: { decrement: transaction.amount },
                        totalExpenditure: { increment: transaction.amount }
                    }
                });
            }

            return tx.transaction.update({
                where: { id: transactionId },
                data: { status: newStatus }
            });
        });

        res.json({ message: 'Signature recorded successfully.', transaction: result });
    } catch (error) {
        console.error('Approve Transaction Error:', error);
        res.status(500).json({ error: 'Failed to record signature.' });
    }
};
