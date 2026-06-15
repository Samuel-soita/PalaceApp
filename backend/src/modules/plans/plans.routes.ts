import { Router } from 'express';
import * as plansController from './plans.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { CreatePlanSchema, UpdatePlanSchema } from '../../schemas/PlanSchema.js';

const router = Router();

router.get('/', authenticate, plansController.getPlans);
router.get('/department/:departmentId', authenticate, plansController.getPlansByDepartment);
router.get('/:id', authenticate, plansController.getPlanById);
router.post('/', authenticate, authorize(['SUPER_ADMIN', 'DEPARTMENT_LEADER', 'WATUA', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR', 'SECRETARY']), validate(CreatePlanSchema), plansController.createPlan);
router.patch('/:id', authenticate, authorize(['SUPER_ADMIN', 'DEPARTMENT_LEADER', 'WATUA', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR', 'SECRETARY']), validate(UpdatePlanSchema), plansController.updatePlan);
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'DEPARTMENT_LEADER', 'WATUA', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR']), plansController.deletePlan);
router.post('/:id/approve', authenticate, authorize(['SUPER_ADMIN', 'PASTOR', 'WATUA']), plansController.approvePlan);
router.patch('/:id/status', authenticate, authorize(['WATUA', 'SUPER_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR']), plansController.updatePlanStatus);

export default router;
