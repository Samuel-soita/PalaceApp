import { Request, Response } from 'express';
import { RecoveryService } from '../../utils/recovery.service.js';

/**
 * GET /recovery/trash
 * List all soft-deleted items across major collections.
 * Role: WATUA, SUPER_ADMIN
 */
export const getTrashBin = async (req: any, res: Response) => {
    try {
        const trash = await RecoveryService.getTrashBin();
        res.json(trash);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to retrieve trash bin' });
    }
};

/**
 * POST /recovery/restore/:type/:id
 * Restore a soft-deleted entity.
 * Role: WATUA, SUPER_ADMIN
 */
export const restoreItem = async (req: any, res: Response) => {
    const { type, id } = req.params;
    try {
        const restored = await RecoveryService.restore(type, id, req.user.id);
        res.json({ message: `${type.toUpperCase()} restored successfully`, data: restored });
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to restore item' });
    }
};
