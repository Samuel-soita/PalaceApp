import { Router } from 'express';
import { recordIncome, requestWithdrawal, approveTransaction } from './finance.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/income', authenticate, recordIncome);
router.post('/withdraw', authenticate, requestWithdrawal);
router.post('/:id/approve', authenticate, approveTransaction);

export default router;
