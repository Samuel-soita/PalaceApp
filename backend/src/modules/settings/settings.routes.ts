import express from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { getSettings, updateSettings } from './settings.controller.js';

const router = express.Router();

router.get('/', getSettings); // Public/Member can view
router.patch('/', authenticate, updateSettings); // Only authorized can update

export default router;
