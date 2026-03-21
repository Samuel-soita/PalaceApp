import { Router } from 'express';
import * as recoveryController from './recovery.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

// Recovery Panel - Restricted to WATUA and SUPER_ADMIN
router.get('/trash', authenticate, authorize(['WATUA', 'SUPER_ADMIN']), recoveryController.getTrashBin);
router.post('/restore/:type/:id', authenticate, authorize(['WATUA', 'SUPER_ADMIN']), recoveryController.restoreItem);

export default router;
