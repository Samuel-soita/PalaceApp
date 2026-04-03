import { Router } from 'express';
import * as meetingController from './meetings.controller.js';
import { authenticate, authorize, moduleGuard } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { CreateMeetingSchema, UpdateMeetingSchema } from '../../schemas/MeetingSchema.js';

const router = Router();

router.post('/', authenticate, authorize(['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR', 'SECRETARY', 'DEPARTMENT_LEADER']), validate(CreateMeetingSchema), meetingController.createMeeting);
router.get('/', authenticate, meetingController.getMeetings);
router.put('/:id', authenticate, authorize(['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR', 'SECRETARY', 'DEPARTMENT_LEADER']), validate(UpdateMeetingSchema), meetingController.updateMeeting);
router.post('/:id/approve', authenticate, authorize(['WATUA', 'SUPER_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR']), meetingController.approveMeeting);
router.delete('/:id', authenticate, authorize(['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR']), meetingController.deleteMeeting);

export default router;
