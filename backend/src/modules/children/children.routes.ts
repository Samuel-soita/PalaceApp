import { Router } from 'express';
import * as childrenController from './children.controller.js';
import { authenticate, moduleGuard } from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/', authenticate, childrenController.registerChild);
router.get('/', authenticate, childrenController.getMyChildren); // Default to parent's children
router.get('/my', authenticate, childrenController.getMyChildren);
router.get('/all', authenticate, moduleGuard('ChildDedication'), childrenController.getAllChildren);

export default router;
