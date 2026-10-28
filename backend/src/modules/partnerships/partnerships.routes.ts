import { Router } from 'express';
import { 
    getAllPartnerships, 
    addLedgerTransaction, 
    deletePartnership,
    updatePartnership
} from './partnerships.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
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

// Pastors are scoped in the controllers (PartnershipManagement module or legacy canManagePartnerships flag).
const PARTNERSHIP_STAFF: Parameters<typeof authorize>[0] = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'WATUA', 'PASTOR', 'ASSOCIATE_PASTOR'];

router.get('/all', authorize(PARTNERSHIP_STAFF), getAllPartnerships);
router.post('/:id/ledger', authorize(PARTNERSHIP_STAFF), validate(LedgerTransactionSchema), addLedgerTransaction);
router.patch('/:id', authorize(PARTNERSHIP_STAFF), updatePartnership);
router.delete('/:id', authorize(['SUPER_ADMIN', 'WATUA']), deletePartnership);

export default router;
