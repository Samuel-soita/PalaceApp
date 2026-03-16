import { Router } from 'express';
import { globalSearch } from './search.controller.js';
import { getAuditLogs } from './audit.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticate, globalSearch);
router.get('/audit', authenticate, getAuditLogs);

export default router;
