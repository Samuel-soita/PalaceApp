import { Router } from 'express';
import { createRepairRequest, approveRepair, getRepairs, updateRepair, deleteRepair } from './repairs.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

// List repairs (All leadership can see)
router.get('/', authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR', 'DEPARTMENT_LEADER', 'SECRETARY', 'WATUA']), getRepairs);

// Create repair (Specifically for Technical/Sound)
router.post('/', authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'DEPARTMENT_LEADER', 'WATUA']), createRepairRequest);

// Approve repair (Pastors, Admin, Bishop)
router.patch('/:id/approve', authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'WATUA']), approveRepair);

// Update/Delete (Technical Leaders)
router.patch('/:id', authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPARTMENT_LEADER', 'WATUA']), updateRepair);
router.delete('/:id', authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPARTMENT_LEADER', 'WATUA']), deleteRepair);

export default router;
