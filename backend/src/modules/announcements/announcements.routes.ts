import { Router } from 'express';
import { getAnnouncements, getAnnouncementById, getAllAnnouncements, createAnnouncement, approveAnnouncement, updateAnnouncement, deleteAnnouncement } from './announcements.controller.js';
import { authenticate, authorize, moduleGuard } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { CreateAnnouncementSchema, UpdateAnnouncementSchema } from '../../schemas/AnnouncementSchema.js';

const router = Router();

router.get('/all', authenticate, authorize(['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR', 'SECRETARY']), getAllAnnouncements);
router.post('/:id/approve', authenticate, authorize(['WATUA', 'SUPER_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR']), approveAnnouncement);
router.get('/', authenticate, getAnnouncements);
router.get('/:id', authenticate, getAnnouncementById);
router.post('/', authenticate, authorize(['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'DEPARTMENT_LEADER', 'SECRETARY']), validate(CreateAnnouncementSchema), createAnnouncement);
router.put('/:id', authenticate, authorize(['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'DEPARTMENT_LEADER', 'SECRETARY']), validate(UpdateAnnouncementSchema), updateAnnouncement);
router.delete('/:id', authenticate, authorize(['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'DEPARTMENT_LEADER', 'SECRETARY']), deleteAnnouncement);

export default router;
