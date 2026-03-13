import { Router } from 'express';
import * as notificationsController from './notifications.controller.js';

const router = Router();

router.get('/user/:userId', notificationsController.getNotifications);
router.patch('/:id/read', notificationsController.markAsRead);

export default router;
