import { Router } from 'express';
import { getAnnouncements, getAllAnnouncements, createAnnouncement, approveAnnouncement, updateAnnouncement, deleteAnnouncement } from './announcements.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticate, getAnnouncements);
router.get('/all', authenticate, getAllAnnouncements);
router.post('/', authenticate, createAnnouncement);
router.post('/:id/approve', authenticate, approveAnnouncement);
router.put('/:id', authenticate, updateAnnouncement);
router.delete('/:id', authenticate, deleteAnnouncement);

export default router;
