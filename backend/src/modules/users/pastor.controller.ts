import { Request, Response } from 'express';
import { prisma } from '../../utils/prisma.js';
import { logAction } from '../../utils/audit.service.js';

/**
 * 👨‍⚖️ PASTORAL RESPONSIBILITY ENGINE - v2.4.0
 * Logic to manage dynamic module assignments for Pastors.
 */

export const getPastorModules = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const { userId } = req.query;
        
        // If userId is provided, ensure requester is an admin/watua
        let targetId = user.id;
        if (userId && ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'WATUA'].includes(user.role)) {
            targetId = userId as string;
        }

        const modules = await (prisma as any).pastorModuleAccess.findMany({
            where: { pastorId: targetId }
        });

        return res.json({
            success: true,
            data: modules
        });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const assignModuleToPastor = async (req: Request, res: Response) => {
    try {
        const { pastorId, moduleKey, permissions } = req.body;
        const actor = (req as any).user;

        // Ensure pastor exists and has PASTOR role
        const pastor = await prisma.user.findUnique({ where: { id: pastorId } });
        if (!pastor || pastor.role !== 'PASTOR') {
            return res.status(400).json({ success: false, message: 'Recipient must be a valid Pastor.' });
        }

        const access = await (prisma as any).pastorModuleAccess.upsert({
            where: {
                pastorId_moduleKey: { pastorId, moduleKey }
            },
            update: { permissions },
            create: { pastorId, moduleKey, permissions }
        });

        await logAction({
            actorId: actor.id,
            actorRole: actor.role,
            actionType: 'ASSIGN_PASTOR_MODULE',
            entityType: 'PASTOR_MODULE_ACCESS',
            entityId: access.id,
            afterState: access,
            metadata: { pastorName: pastor.name, moduleKey }
        });

        return res.json({ success: true, data: access });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const revokeModuleFromPastor = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const actor = (req as any).user;

        const access = await (prisma as any).pastorModuleAccess.delete({
            where: { id }
        });

        await logAction({
            actorId: actor.id,
            actorRole: actor.role,
            actionType: 'REVOKE_PASTOR_MODULE',
            entityType: 'PASTOR_MODULE_ACCESS',
            entityId: id,
            beforeState: access
        });

        return res.json({ success: true, message: 'Module access revoked.' });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
