import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';

export const getDailyDevotion = async (req: Request, res: Response) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let devotion = await prisma.devotion.findUnique({
            where: { date: today },
            include: {
                interactions: {
                    select: { type: true, value: true, userId: true }
                }
            }
        });

        if (!devotion) {
            // Fetch Global Themes from settings
            const settings = await prisma.ministrySettings.findUnique({
                where: { id: 'GLOBAL' }
            });

            // Seed a placeholder with current themes if none exists for today
            devotion = await prisma.devotion.create({
                data: {
                    title: 'Walking in Divine Purpose',
                    content: 'Today, remember that you are called for a greater purpose. The challenges you face are but stepping stones to your destiny.',
                    themeOfMonth: settings?.themeOfMonth || 'MONTH OF NEW BEGINNINGS',
                    themeOfYear: settings?.themeOfYear || 'YEAR OF DIVINE ESTABLISHMENT',
                    date: today
                },
                include: { interactions: true }
            }) as any;
        }

        res.json(devotion);
    } catch (error) {
        console.error('[Get Devotion Error]', error);
        res.status(500).json({ error: 'Failed to retrieve daily devotion.' });
    }
};

export const interactWithDevotion = async (req: any, res: Response) => {
    const { devotionId } = req.params;
    const { type, value } = req.body;
    const userId = req.user.id;

    try {
        // Toggle interaction: if same type and same user, remove it
        const existing = await prisma.devotionInteraction.findFirst({
            where: { devotionId, userId, type }
        });

        if (existing) {
            await prisma.devotionInteraction.delete({ where: { id: existing.id } });
            return res.json({ message: 'Interaction removed.' });
        }

        const interaction = await prisma.devotionInteraction.create({
            data: { devotionId, userId, type, value }
        });

        await logAudit(userId, `DEVOTION_${type}`, 'DEVOTION', devotionId, { value });

        res.json({ message: 'Interaction recorded.', interaction });
    } catch (error) {
        console.error('[Devotion Interaction Error]', error);
        res.status(500).json({ error: 'Failed to record interaction.' });
    }
};
