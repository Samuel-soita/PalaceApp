import { Router } from 'express';
import * as projectsController from './projects.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticate, projectsController.getProjects);
router.get('/department/:departmentId', authenticate, projectsController.getProjectsByDepartment);
router.post('/', authenticate, projectsController.createProject);
router.patch('/:id', authenticate, projectsController.updateProject);
router.delete('/:id', authenticate, projectsController.deleteProject);
router.post('/:id/updates', authenticate, projectsController.addProjectUpdate);
router.post('/:id/approve', authenticate, projectsController.approveProject);

export default router;
