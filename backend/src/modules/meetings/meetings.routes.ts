import { Router } from 'express';
import * as meetingController from './meetings.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/', authenticate, meetingController.createMeeting);
router.get('/', authenticate, meetingController.getMeetings);
router.put('/:id', authenticate, meetingController.updateMeeting);
router.post('/:id/approve', authenticate, meetingController.approveMeeting);
router.delete('/:id', authenticate, meetingController.deleteMeeting);

export default router;
