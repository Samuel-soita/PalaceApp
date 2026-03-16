import { Router } from 'express';
import * as usersController from './users.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticate, usersController.getUsers);
router.get('/pending', authenticate, authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR']), usersController.getPendingUsers);
router.patch('/:id/status', authenticate, authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR']), usersController.activateUser);

// Watua Intervention Routes
router.get('/technical/all', authenticate, authorize(['WATUA']), usersController.getUsersTechnical);
router.get('/technical/stats', authenticate, authorize(['WATUA']), usersController.getSystemStats);
router.get('/technical/diagnostics', authenticate, authorize(['WATUA']), usersController.getSystemDiagnostics);
router.get('/technical/audit/all', authenticate, authorize(['WATUA']), usersController.getAuditLogsTechnical);
router.post('/technical/intervention/:id', authenticate, authorize(['WATUA']), usersController.executeIntervention);
router.patch('/technical/bio/:id', authenticate, authorize(['WATUA']), usersController.updateUserBioTechnical);

export default router;
