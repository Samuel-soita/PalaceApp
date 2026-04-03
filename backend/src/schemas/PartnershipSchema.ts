import { z } from 'zod';

/**
 * 💰 Financial & Covenant Partnership Schemas - v2.4.0
 */
export const EnrollPartnershipSchema = z.object({
    body: z.object({
        userId: z.string().uuid(),
        amount: z.number().min(700, 'Minimum enrollment seed is 700 KES.'),
        frequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
        initialPaymentMethod: z.enum(['MPESA', 'CASH', 'BANK_TRANSFER', 'CHEQUE']).default('MPESA'),
        referenceCode: z.string().min(5).max(20).optional()
    })
});

export const AddLedgerTransactionSchema = z.object({
    body: z.object({
        partnershipId: z.string().uuid(),
        amount: z.number().positive('Transaction amount must be positive.'),
        paymentMethod: z.enum(['MPESA', 'CASH', 'BANK_TRANSFER', 'CHEQUE']),
        referenceCode: z.string().min(5).max(50),
        transactionType: z.enum(['CREDIT', 'DEBIT', 'ADJUSTMENT']).default('CREDIT')
    })
});

export const PartnershipUpdateSchema = z.object({
    params: z.object({
        id: z.string().uuid()
    }),
    body: z.object({
        status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'COMPLETED']).optional(),
        frequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
        amount: z.number().min(700).optional()
    }).strict()
});
