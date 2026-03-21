import { Router } from 'express';
import * as partnershipController from './partnerships.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/all', authenticate, authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'WATUA', 'PASTOR']), partnershipController.getAllPartnerships);
router.post('/:id/ledger', authenticate, authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY']), partnershipController.addLedgerTransaction);
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'WATUA']), partnershipController.deletePartnership);

export default router;
