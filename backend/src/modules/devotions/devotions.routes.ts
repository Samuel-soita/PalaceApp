import { Router } from 'express';
import * as devotionsController from './devotions.controller.js';
import { authenticate, moduleGuard } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/daily', authenticate, devotionsController.getDailyDevotion);
router.get('/all', authenticate, moduleGuard('DevotionPublishing'), devotionsController.getDevotions);
router.post('/', authenticate, moduleGuard('DevotionPublishing'), devotionsController.createDevotion);
router.post('/:devotionId/interact', authenticate, devotionsController.interactWithDevotion);

export default router;
