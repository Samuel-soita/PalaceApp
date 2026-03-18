import express from 'express';
import { requestBaptism, updateBaptismStatus, getBaptisms, updateChildDedicationStatus } from './workflows.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = express.Router();

/**
 * Baptism Routes
 */
// Member requests baptism
router.post('/baptism', authenticate, requestBaptism);

// Admin/Pastor updates baptism status
router.patch('/baptism/:id/status', authenticate, authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'PASTOR', 'WATUA']), updateBaptismStatus);

// View baptisms (Admins see all, Members see own)
router.get('/baptism', authenticate, getBaptisms);

/**
 * Child Dedication Routes
 */
// Admin/Pastor updates child dedication status
router.patch('/dedication/:id/status', authenticate, authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'PASTOR', 'WATUA']), updateChildDedicationStatus);

export default router;
