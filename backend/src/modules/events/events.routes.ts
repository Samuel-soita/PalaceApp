import { Router } from 'express';
import { getEvents, getEventsByDepartment, createEvent, updateEvent, deleteEvent, approveEvent } from './events.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticate, getEvents);
router.get('/department/:departmentId', authenticate, getEventsByDepartment);
router.post('/', authenticate, authorize(['SUPER_ADMIN', 'DEPARTMENT_LEADER']), createEvent);
router.post('/:id/approve', authenticate, authorize(['SUPER_ADMIN', 'WATUA']), approveEvent);
router.patch('/:id', authenticate, authorize(['SUPER_ADMIN', 'DEPARTMENT_LEADER']), updateEvent);
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'DEPARTMENT_LEADER']), deleteEvent);

export default router;
