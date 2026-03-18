import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';

export const getAllPartnerships = async (req: any, res: Response) => {
    try {
        const partnerships = await prisma.partnership.findMany({
            include: {
                user: {
                    select: {
                        name: true,
                        membershipNumber: true,
                        department: { select: { name: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(partnerships);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch partnerships.' });
    }
};

export const updatePayment = async (req: any, res: Response) => {
    const { id } = req.params;
    const { paidAmount } = req.body; // The amount just paid

    try {
        const current = await prisma.partnership.findUnique({ where: { id } });
        if (!current) return res.status(404).json({ error: 'Partnership record not found.' });

        const newPaidTotal = current.paidAmount + Number(paidAmount);
        const newBalance = Math.max(0, current.amount - newPaidTotal);

        const updated = await prisma.partnership.update({
            where: { id },
            data: {
                paidAmount: newPaidTotal,
                balance: newBalance,
                lastPaymentDate: new Date()
            }
        });

        await logAudit(req.user.id, 'PARTNERSHIP_PAYMENT', 'PARTNERSHIP', id, { 
            amountPaid: paidAmount, 
            newBalance, 
            memberId: current.userId 
        });

        res.json({ message: 'Partnership payment tabulated and balance updated.', partnership: updated });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update partnership payment.' });
    }
};

export const deletePartnership = async (req: any, res: Response) => {
    const { id } = req.params;
    try {
        const partnership = await prisma.partnership.delete({ where: { id } });
        await prisma.user.update({
            where: { id: partnership.userId },
            data: { isPartner: false }
        });
        await logAudit(req.user.id, 'DELETE_PARTNERSHIP', 'PARTNERSHIP', id, { memberId: partnership.userId });
        res.json({ message: 'Partnership record dissolved.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to dissolve partnership.' });
    }
};
