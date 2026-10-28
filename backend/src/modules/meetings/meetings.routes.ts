import { Router } from 'express';
import * as meetingController from './meetings.controller.js';
import { authenticate, authorize, Role } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { CreateMeetingSchema, UpdateMeetingSchema } from '../../schemas/MeetingSchema.js';

const router = Router();

router.post('/', authenticate, authorize(['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR', 'SECRETARY', 'DEPARTMENT_LEADER']), validate(CreateMeetingSchema), meetingController.createMeeting);
router.get('/', authenticate, meetingController.getMeetings);
router.get('/:id', authenticate, meetingController.getMeetingById);
const meetingEditors: Role[] = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR', 'SECRETARY', 'DEPARTMENT_LEADER'];
router.put('/:id', authenticate, authorize(meetingEditors), validate(UpdateMeetingSchema), meetingController.updateMeeting);
router.patch('/:id', authenticate, authorize(meetingEditors), validate(UpdateMeetingSchema), meetingController.updateMeeting);
router.delete('/:id', authenticate, authorize(['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR', 'DEPARTMENT_LEADER']), meetingController.deleteMeeting);

export default router;
