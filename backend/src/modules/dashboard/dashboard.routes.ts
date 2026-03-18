import express from 'express';
import { getDashboardSync } from './dashboard.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.get('/sync', authenticate, getDashboardSync);

export default router;
