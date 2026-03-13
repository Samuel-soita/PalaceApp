import { Router } from 'express';
import * as deptController from './departments.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/', authenticate, authorize(['SUPER_ADMIN']), deptController.createDepartment);
router.get('/', authenticate, deptController.getDepartments);
router.get('/:id', authenticate, deptController.getDepartmentById);

export default router;
