import { Router } from 'express';
import * as plansController from './plans.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticate, plansController.getPlans);
router.get('/department/:departmentId', authenticate, plansController.getPlansByDepartment);
router.post('/', authenticate, authorize(['SUPER_ADMIN', 'DEPARTMENT_LEADER', 'WATUA']), plansController.createPlan);
router.patch('/:id', authenticate, authorize(['SUPER_ADMIN', 'DEPARTMENT_LEADER', 'WATUA']), plansController.updatePlan);
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'DEPARTMENT_LEADER', 'WATUA']), plansController.deletePlan);
router.post('/:id/approve', authenticate, authorize(['SUPER_ADMIN', 'PASTOR', 'WATUA']), plansController.approvePlan);

export default router;
