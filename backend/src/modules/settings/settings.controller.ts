import { Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAction } from '../../utils/audit.service.js';
import { BackupEngine } from '../../utils/backup.service.js';

export const getSettings = async (req: any, res: Response) => {
    try {
        let settings = await prisma.ministrySettings.findUnique({
            where: { id: 'GLOBAL' }
        });

        if (!settings) {
            // Seed default settings if missing
            settings = await prisma.ministrySettings.create({
                data: { id: 'GLOBAL' }
            });
        }

        res.json(settings);
    } catch (error) {
        console.error('[Get Settings Error]', error);
        res.status(500).json({ error: 'Failed to fetch settings.' });
    }
};

export const updateSettings = async (req: any, res: Response) => {
    const { themeOfYear, themeOfMonth } = req.body;
    const actorId = req.user.id;

    // Strict Authorization: Only Pastor/Bishop/SuperAdmin can update global themes
    if (!['PASTOR', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'WATUA'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Unauthorized to update global themes.' });
    }

    try {
        const settings = await prisma.ministrySettings.upsert({
            where: { id: 'GLOBAL' },
            create: {
                id: 'GLOBAL',
                themeOfYear,
                themeOfMonth
            },
            update: {
                themeOfYear,
                themeOfMonth
            }
        });
        await logAction({
            actorId,
            actionType: 'UPDATE_MINISTRY_SETTINGS',
            entityType: 'SETTINGS',
            entityId: 'GLOBAL',
            beforeState: null,
            afterState: settings,
            metadata: { themeOfYear, themeOfMonth }
        });

        res.json({ message: 'Ministry settings updated successfully.', settings });
    } catch (error) {
        console.error('[Update Settings Error]', error);
        res.status(500).json({ error: 'Failed to update settings.' });
    }
};

export const triggerBackup = async (req: any, res: Response) => {
    try {
        const filepath = await BackupEngine.createSnapshot(req.user.id);
        res.json({ message: 'Disaster Recovery Snapshot generated successfully.', file: filepath });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
