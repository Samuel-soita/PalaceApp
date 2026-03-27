import { Router } from 'express';
import * as notificationsController from './notifications.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/user/:userId', authenticate, notificationsController.getNotifications);
router.patch('/:id/read', authenticate, notificationsController.markAsRead);

export default router;
