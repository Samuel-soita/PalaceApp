import { Router } from 'express';
import { createBudget, getBudgets, updateBudget, deleteBudget, fundBudget } from './budgets.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/', authenticate, authorize(['SUPER_ADMIN', 'PASTOR', 'DEPARTMENT_LEADER', 'WATUA']), createBudget);
router.get('/', authenticate, getBudgets);
router.post('/:id/contribute', authenticate, fundBudget);
router.put('/:id', authenticate, authorize(['SUPER_ADMIN', 'PASTOR', 'DEPARTMENT_LEADER', 'WATUA']), updateBudget);
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'WATUA']), deleteBudget);

export default router;
