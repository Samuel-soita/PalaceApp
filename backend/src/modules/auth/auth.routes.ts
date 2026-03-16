import { Router } from 'express';
import * as authController from './auth.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { loginRateLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

router.post('/register', authController.register);
router.post('/login', loginRateLimiter, authController.login);
router.post('/watua-access', authController.watuaAccess);
router.get('/profile', authenticate, authController.getProfile);
router.patch('/profile', authenticate, authController.updateProfile);

export default router;
