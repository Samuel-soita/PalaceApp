import { Router } from 'express';
import * as plansController from './plans.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', plansController.getPlans);
router.get('/department/:departmentId', plansController.getPlansByDepartment);
router.post('/', authenticate, authorize(['SUPER_ADMIN', 'DEPARTMENT_LEADER']), plansController.createPlan);
router.patch('/:id', authenticate, authorize(['SUPER_ADMIN', 'DEPARTMENT_LEADER']), plansController.updatePlan);
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'DEPARTMENT_LEADER']), plansController.deletePlan);
router.post('/:id/approve', authenticate, authorize(['SUPER_ADMIN', 'PASTOR']), plansController.approvePlan);

export default router;
