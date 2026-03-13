import { Router } from 'express';
import { getAssets, getAssetsByDepartment, createAsset, updateAsset, deleteAsset } from './assets.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticate, getAssets);
router.get('/department/:departmentId', authenticate, getAssetsByDepartment);
router.post('/', authenticate, createAsset);
router.put('/:id', authenticate, updateAsset);
router.delete('/:id', authenticate, deleteAsset);

export default router;
