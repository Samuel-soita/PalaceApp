import { Router } from 'express';
import * as projectsController from './projects.controller.js';

const router = Router();

router.get('/', projectsController.getProjects);
router.get('/department/:departmentId', projectsController.getProjectsByDepartment);
router.post('/', projectsController.createProject);
router.patch('/:id', projectsController.updateProject);
router.delete('/:id', projectsController.deleteProject);
router.post('/:id/updates', projectsController.addProjectUpdate);
router.post('/:id/approve', projectsController.approveProject);

export default router;
