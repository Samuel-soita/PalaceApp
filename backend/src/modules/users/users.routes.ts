import { Router } from 'express';
import * as usersController from './users.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import { mutationLimiter } from '../../middleware/rate-limiting.middleware.js';

const router = Router();

router.get('/', authenticate, usersController.getUsers);
router.get('/pending', authenticate, authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR']), usersController.getPendingUsers);
router.patch('/:id/status', authenticate, authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR']), usersController.activateUser);
router.patch('/:id/mark-paid', authenticate, authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY']), usersController.markCardAsPaid);

// Watua Intervention Routes
router.get('/technical/all', authenticate, authorize(['WATUA']), usersController.getUsersTechnical);
router.get('/technical/stats', authenticate, authorize(['WATUA']), usersController.getSystemStats);
router.get('/technical/diagnostics', authenticate, authorize(['WATUA']), usersController.getSystemDiagnostics);
router.get('/technical/audit/all', authenticate, authorize(['WATUA']), usersController.getAuditLogsTechnical);
router.get('/technical/trash', authenticate, authorize(['WATUA']), usersController.getTrashHub);
router.post('/technical/restore/:id', authenticate, authorize(['WATUA', 'SUPER_ADMIN']), mutationLimiter, usersController.restoreEntity);
router.get('/technical/flags', authenticate, authorize(['WATUA']), usersController.getFeatureFlags);
router.patch('/technical/flags', authenticate, authorize(['WATUA']), mutationLimiter, usersController.updateFeatureFlag);
router.post('/technical/intervention/:id', authenticate, authorize(['WATUA', 'SUPER_ADMIN', 'SECRETARY']), mutationLimiter, usersController.executeIntervention);
router.patch('/technical/bio/:id', authenticate, authorize(['WATUA']), mutationLimiter, usersController.updateUserBioTechnical);
router.post('/partnership/enroll', authenticate, usersController.enrollPartnership);
router.post('/card-renewal/request', authenticate, usersController.requestCardRenewal);
router.post('/:id/card-renewal/approve', authenticate, authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY']), usersController.approveCardRenewal);

import * as watuaController from './watua.controller.js';

// Watua Dual-Auth Routes
router.post('/technical/action', authenticate, authorize(['WATUA']), mutationLimiter, watuaController.initiateCriticalAction);
router.post('/technical/action/:id/approve', authenticate, authorize(['WATUA', 'SUPER_ADMIN']), mutationLimiter, watuaController.approveCriticalAction);
router.delete('/technical/action/:id', authenticate, authorize(['WATUA', 'SUPER_ADMIN']), mutationLimiter, watuaController.cancelCriticalAction);

export default router;
