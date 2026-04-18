import { Router } from 'express';
import { 
    getAllPartnerships, 
    addLedgerTransaction, 
    deletePartnership,
    updatePartnership
} from './partnerships.controller.js';
import { authenticate, authorize, moduleGuard } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

const LedgerTransactionSchema = z.object({
    body: z.object({
        amount: z.number().positive('Amount must be positive'),
        paymentMethod: z.enum(['MPESA', 'BANK_TRANSFER', 'CASH', 'CHEQUE', 'SYSTEM']),
        referenceCode: z.string().min(3, 'Reference code is mandatory'),
        transactionType: z.enum(['CREDIT', 'DEBIT']).default('CREDIT')
    })
});

router.get('/all', authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'WATUA', 'PASTOR']), moduleGuard('PartnershipManagement'), getAllPartnerships);
router.post('/:id/ledger', authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY']), validate(LedgerTransactionSchema), addLedgerTransaction);
router.patch('/:id', authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'PASTOR']), updatePartnership);
router.delete('/:id', authorize(['SUPER_ADMIN', 'WATUA']), deletePartnership);

export default router;
