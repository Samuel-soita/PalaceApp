import { Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';

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

        await logAudit(actorId, 'UPDATE_MINISTRY_SETTINGS', 'SETTINGS', 'GLOBAL', { themeOfYear, themeOfMonth });

        res.json({ message: 'Ministry settings updated successfully.', settings });
    } catch (error) {
        console.error('[Update Settings Error]', error);
        res.status(500).json({ error: 'Failed to update settings.' });
    }
};
