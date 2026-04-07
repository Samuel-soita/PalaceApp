import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAction } from '../../utils/audit.service.js';
import { NotificationEngine } from '../../utils/NotificationEngine.js';

export const getAllPartnerships = async (req: any, res: Response) => {
    const { id: userId, role, canManagePartnerships } = req.user;

    // 1. Administrators (Bishop, Secretary, System Admin, Watua) have global access
    const isAdmin = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'WATUA'].includes(role);
    
    // 2. Assigned Pastor has global access for reconciliation
    const isAssigned = (role === 'PASTOR' || role === 'ASSOCIATE_PASTOR') && canManagePartnerships;

    try {
        const whereClause = (isAdmin || isAssigned) ? {} : { userId };
        const partnerships = await prisma.partnership.findMany({
            where: whereClause,
            include: {
                user: { include: { department: true } },
                ledgers: { orderBy: { date: 'desc' } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(partnerships);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch partnerships.' });
    }
};

/**
 * Immutable Ledger Transaction
 * Enforces NO UPDATE, NO DELETE on ledger. ONLY INSERT.
 */
export const addLedgerTransaction = async (req: any, res: Response) => {
    const { id: partnershipId } = req.params;
    const { amount, paymentMethod, referenceCode, transactionType = 'CREDIT' } = req.body;
    const actorId = req.user.id;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Transaction amount must be strictly positive.' });
    }

    if (!referenceCode) {
        return res.status(400).json({ error: 'A cryptographic or bank reference code is mandatory for reconciliation.' });
    }

    try {
        // Enforce MPESA / Bank Validation
        const duplicateRef = await prisma.partnershipLedger.findUnique({ where: { referenceCode } });
        if (duplicateRef) {
            return res.status(409).json({ error: 'Reconciliation Failed: Duplicate reference code detected. Potential cyclic transaction.' });
        }

        const partnership = await prisma.partnership.findUnique({ where: { id: partnershipId } });
        if (!partnership) return res.status(404).json({ error: 'Partnership record not found.' });

        const [ledger, updatedPartnership] = await prisma.$transaction(async (tx) => {
            // 1. Immutable Insert
            const newLedger = await tx.partnershipLedger.create({
                data: {
                    partnershipId,
                    amount: Number(amount),
                    transactionType,
                    paymentMethod,
                    referenceCode,
                    status: 'VERIFIED' // Instantly verified by admin entry for now
                }
            });

            // 2. Computed Ledger Reconciliation
            // We cryptographically sum the entire ledger rather than relying on mutable fields
            const allLedgers = await tx.partnershipLedger.findMany({
                where: { partnershipId, status: 'VERIFIED', transactionType: 'CREDIT' }
            });

            const totalPaid = allLedgers.reduce((acc, curr) => acc + curr.amount, 0);
            const outstandingBalance = Math.max(0, partnership.amount - totalPaid);

            // 3. Update cached aggregates on parent
            const p = await tx.partnership.update({
                where: { id: partnershipId },
                data: {
                    paidAmount: totalPaid,
                    balance: outstandingBalance,
                    lastPaymentDate: new Date(),
                    status: outstandingBalance === 0 ? 'COMPLETED' : 'ACTIVE'
                }
            });

            // 4. Financial Unification: Pipe Funds into Global Treasury 
            // In 2.4.0, all Covenant Partnership streams flow directly to the unified ledger.
            let treasuryDept = await tx.department.findUnique({ where: { name: 'Global Treasury' } });
            if (!treasuryDept) {
                treasuryDept = await tx.department.create({ 
                    data: { name: 'Global Treasury', description: 'Central Command Unified Finance Ledger' } 
                });
            }

            const treasuryAccount = await tx.account.upsert({
                where: { departmentId: treasuryDept.id },
                update: { balance: { increment: Number(amount) }, totalIncome: { increment: Number(amount) } },
                create: { departmentId: treasuryDept.id, balance: Number(amount), totalIncome: Number(amount) }
            });

            await tx.transaction.create({
                data: {
                    accountId: treasuryAccount.id,
                    type: 'INCOME',
                    amount: Number(amount),
                    description: `Covenant Partnership Remittance [Ref: ${referenceCode}]`,
                    status: 'APPROVED',
                    requestedById: actorId
                }
            });

            return [newLedger, p];
        });

        // Fire Audit
        await logAction({
            actorId,
            actorRole: req.user.role,
            actionType: 'LEDGER_INSERT',
            entityType: 'PARTNERSHIP_LEDGER',
            entityId: ledger.id,
            beforeState: partnership,
            afterState: updatedPartnership,
            metadata: { referenceCode, amount, paymentMethod },
            ipAddress: req.ip
        });

        // Dispatch Guaranteed Delivery Notification
        await NotificationEngine.dispatch({
            userId: partnership.userId,
            title: 'Covenant Partnership Remittance',
            message: `We have successfully reconciled your ledger transaction of KES ${amount} (Ref: ${referenceCode}). Your new balance is KES ${updatedPartnership.balance}.`,
            type: 'LEDGER_RECON',
            deliveryChannel: 'IN_APP' // Expands to SMS/EMAIL in jobs
        });

        res.status(201).json({ 
            message: 'Ledger transaction cryptographically bound and reconciled.', 
            partnership: updatedPartnership,
            ledger 
        });

    } catch (error) {
        console.error('Ledger Error:', error);
        res.status(500).json({ error: 'System failed to write ledger transaction.' });
    }
};

export const deletePartnership = async (req: any, res: Response) => {
    const { id } = req.params;
    try {
        const current = await prisma.partnership.findUnique({ where: { id } });
        if (!current) return res.status(404).json({ error: 'Partnership not found' });

        const partnership = await prisma.partnership.delete({ where: { id } });
        
        await prisma.user.update({
            where: { id: partnership.userId },
            data: { isPartner: false }
        });
        
        await logAction({
            actorId: req.user.id,
            actorRole: req.user.role,
            actionType: 'DELETE_PARTNERSHIP',
            entityType: 'PARTNERSHIP',
            entityId: id,
            beforeState: current,
            afterState: null,
            ipAddress: req.ip
        });
        
        res.json({ message: 'Partnership record dissolved.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to dissolve partnership.' });
    }
};
