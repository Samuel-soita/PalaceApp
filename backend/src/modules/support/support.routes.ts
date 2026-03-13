import express from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { getSupportRequests, createSupportRequest, fundSupportRequest } from './support.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getSupportRequests);
router.post('/', createSupportRequest);
router.patch('/:id/fund', fundSupportRequest);

export default router;
