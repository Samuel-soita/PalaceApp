import { Router } from 'express';
import * as devotionsController from './devotions.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/daily', authenticate, devotionsController.getDailyDevotion);
router.post('/:devotionId/interact', authenticate, devotionsController.interactWithDevotion);

export default router;
