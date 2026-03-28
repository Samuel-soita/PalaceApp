import { Router } from 'express';
import { getDeltaSync } from './sync.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

/**
 * Modular Delta Sync Interface.
 * Standardized across all 2.4.0 PWA tactical agents.
 */
router.get('/:module', authenticate, getDeltaSync);

export default router;
