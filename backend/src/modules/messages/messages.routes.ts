import { Router } from 'express';
import * as messagesController from './messages.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticate, messagesController.getMessages);
router.post('/', authenticate, messagesController.createMessage);
router.patch('/:id', authenticate, messagesController.updateMessage);
router.delete('/:id', authenticate, messagesController.deleteMessage);

export default router;
