import { Router } from 'express';
import * as deptController from './departments.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { CreateDepartmentSchema } from '../../schemas/DepartmentSchema.js';

const router = Router();

router.post('/', authenticate, authorize(['SUPER_ADMIN']), validate(CreateDepartmentSchema), deptController.createDepartment);
router.get('/', authenticate, deptController.getDepartments);
router.get('/tally', authenticate, deptController.getUsheringTally);
router.get('/:id', authenticate, deptController.getDepartmentById);

export default router;
