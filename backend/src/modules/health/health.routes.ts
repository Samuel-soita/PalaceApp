import { Router } from 'express';
import { getSystemHealth } from './health.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

// Only highest clearance levels have access to detailed Kernel infrastructure
router.get('/', authenticate, authorize(['SUPER_ADMIN', 'WATUA', 'SYSTEM_ADMIN']), getSystemHealth);

export default router;
