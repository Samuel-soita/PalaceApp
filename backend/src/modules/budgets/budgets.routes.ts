import { Router } from 'express';
import { createBudget, getBudgets, updateBudget, deleteBudget } from './budgets.controller.js';
import { getAccountSummary, getTransactions, createTransaction, approveTransaction } from './accounts.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/', authenticate, authorize(['SUPER_ADMIN', 'PASTOR', 'DEPARTMENT_LEADER', 'WATUA']), createBudget);
router.get('/', authenticate, getBudgets);
router.put('/:id', authenticate, authorize(['SUPER_ADMIN', 'PASTOR', 'DEPARTMENT_LEADER', 'WATUA']), updateBudget);
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'WATUA']), deleteBudget);

// Account Routes
router.get('/accounts/summary/:departmentId', authenticate, getAccountSummary);
router.get('/accounts/transactions/:departmentId', authenticate, getTransactions);
router.post('/accounts/transactions', authenticate, authorize(['DEPARTMENT_LEADER', 'WATUA']), createTransaction);
router.patch('/accounts/transactions/:id/approve', authenticate, authorize(['SUPER_ADMIN', 'PASTOR', 'WATUA']), approveTransaction);

export default router;
