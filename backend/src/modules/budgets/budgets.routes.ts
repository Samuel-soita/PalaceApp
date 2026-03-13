import { Router } from 'express';
import * as budgetController from './budgets.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/', authenticate, budgetController.createBudget);
router.get('/', authenticate, budgetController.getBudgets);
router.put('/:id', authenticate, budgetController.updateBudget);
router.delete('/:id', authenticate, budgetController.deleteBudget);

export default router;
