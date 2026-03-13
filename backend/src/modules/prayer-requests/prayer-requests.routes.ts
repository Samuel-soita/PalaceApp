import { Router } from 'express';
import { getPrayerRequests, createPrayerRequest, updatePrayerRequest, deletePrayerRequest } from './prayer-requests.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticate, getPrayerRequests);
router.post('/', authenticate, createPrayerRequest);
router.put('/:id', authenticate, updatePrayerRequest);
router.delete('/:id', authenticate, deletePrayerRequest);

export default router;
