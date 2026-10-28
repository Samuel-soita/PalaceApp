import { Router } from 'express';
import * as appointmentsController from './appointments.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/', authenticate, appointmentsController.createAppointment);
router.get('/me', authenticate, appointmentsController.getMyAppointments);
router.get('/all', authenticate, authorize(['WATUA', 'SUPER_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR', 'SYSTEM_ADMIN', 'SECRETARY']), appointmentsController.getAllAppointments);
router.patch('/:id/status', authenticate, authorize(['WATUA', 'SUPER_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR', 'SYSTEM_ADMIN', 'SECRETARY']), appointmentsController.updateAppointmentStatus);

export default router;
