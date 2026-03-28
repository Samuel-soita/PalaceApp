import express from 'express';
import { getDashboardSync, getSystemHealth } from './dashboard.controller.js';
import * as insightsController from './insights.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.get('/sync', authenticate, getDashboardSync);
router.get('/health', authenticate, authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'WATUA']), getSystemHealth);

// Governance & Decision Intelligence
router.get('/governance', authenticate, authorize(['SUPER_ADMIN', 'WATUA', 'SYSTEM_ADMIN']), insightsController.getGovernanceDashboard);
router.get('/export/ledger', authenticate, authorize(['SUPER_ADMIN', 'WATUA']), insightsController.exportLedger);

export default router;
