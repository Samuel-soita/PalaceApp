import { Router } from 'express';
import { getPublicUpdates } from './public.controller.js';

const router = Router();

/**
 * 🔓 PUBLIC ENDPOINT: No authentication required.
 * Used for the unlogged-in global activity ticker.
 */
router.get('/notifications', getPublicUpdates);

export default router;
