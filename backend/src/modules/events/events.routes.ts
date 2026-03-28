import { Router } from 'express';
import { getEvents, getEventsByDepartment, createEvent, updateEvent, deleteEvent, approveEvent } from './events.controller.js';
import { authenticate, authorize, moduleGuard } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticate, getEvents);
router.get('/department/:departmentId', authenticate, getEventsByDepartment);
router.post('/', authenticate, moduleGuard('EventOversight'), authorize(['SUPER_ADMIN', 'DEPARTMENT_LEADER', 'PASTOR']), createEvent);
router.post('/:id/approve', authenticate, moduleGuard('EventOversight'), authorize(['SUPER_ADMIN', 'WATUA', 'PASTOR']), approveEvent);
router.patch('/:id', authenticate, authorize(['SUPER_ADMIN', 'DEPARTMENT_LEADER', 'PASTOR']), moduleGuard('EventOversight'), updateEvent);
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'DEPARTMENT_LEADER', 'PASTOR']), moduleGuard('EventOversight'), deleteEvent);

export default router;
