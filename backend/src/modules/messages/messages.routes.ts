import { Router } from 'express';
import * as messagesController from './messages.controller.js';

const router = Router();

router.get('/', messagesController.getMessages);
router.post('/', messagesController.createMessage);
router.patch('/:id', messagesController.updateMessage);
router.delete('/:id', messagesController.deleteMessage);

export default router;
