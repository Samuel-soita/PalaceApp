import express from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import { getSettings, updateSettings, triggerBackup } from './settings.controller.js';
import * as featureFlagController from './feature-flag.controller.js';

const router = express.Router();

router.get('/', getSettings); // Public/Member can view
router.patch('/', authenticate, authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'WATUA']), updateSettings); // Only authorized can update
router.post('/backup', authenticate, authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN']), triggerBackup);

// Feature Flags
router.get('/flags', authenticate, authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN']), featureFlagController.getFlags);
router.patch('/flags', authenticate, authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN']), featureFlagController.updateFlag);
router.get('/flags/check/:name', authenticate, featureFlagController.checkFlag);

export default router;
