import { Router } from 'express';
import { requestWithdrawal, approveTransaction, getAllAccountSummaries, getAccountSummary, getTransactions, recordManualIncome } from './finance.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import { auditLogger } from '../../middleware/audit.middleware.js';

const router = Router();
router.use(authenticate); // Global auth for finance
router.use(auditLogger); // Global audit for finance (Now has user context!)

// Ledger Oversight
router.get('/accounts/all', authenticate, authorize(['SUPER_ADMIN', 'PASTOR', 'SYSTEM_ADMIN', 'WATUA']), getAllAccountSummaries);
router.get('/accounts/summary/:departmentId', authenticate, getAccountSummary);
router.get('/accounts/transactions/:departmentId', authenticate, getTransactions);

// Manual Income (Restricted to Admins ONLY in 2.4.0)
router.post('/income', authenticate, authorize(['SUPER_ADMIN', 'WATUA', 'SYSTEM_ADMIN', 'DEPARTMENT_LEADER']), recordManualIncome);

// Expenditure Workflows
router.post('/withdraw', authenticate, requestWithdrawal);
router.post('/:id/approve', authenticate, approveTransaction);

export default router;
