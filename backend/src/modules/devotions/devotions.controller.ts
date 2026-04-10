import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAction } from '../../utils/audit.service.js';

export const getDailyDevotion = async (req: Request, res: Response) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const devotion = await prisma.devotion.findUnique({
            where: { date: today },
            include: {
                interactions: {
                    select: { type: true, value: true, userId: true }
                }
            }
        });

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

        await logAction({
            actorId: userId,
            actionType: `DEVOTION_${type}`,
            entityType: 'DEVOTION',
            entityId: devotionId,
            metadata: { value }
        });

        res.json({ message: 'Interaction recorded.', interaction });
    } catch (error) {
        console.error('[Devotion Interaction Error]', error);
        res.status(500).json({ error: 'Failed to record interaction.' });
    }
};

/**
 * 📖 DEVOTION Spiritual Engine - v2.4.0
 * Logic to automate affirmation extraction from devotion content.
 */
export const createDevotion = async (req: Request, res: Response) => {
    try {
        const { title, content, themeOfMonth, themeOfYear, date } = req.body;
        const actor = (req as any).user;

        // 🛡️ Authorization Check: Only Pastors and Global Executives can publish Daily Devotions
        const highPrivilegeRoles = ['SUPER_ADMIN', 'WATUA', 'SYSTEM_ADMIN'];
        const isHighPrivilege = highPrivilegeRoles.includes(actor.role);
        const isPastor = ['PASTOR', 'ASSOCIATE_PASTOR'].includes(actor.role);

        if (!isHighPrivilege && !isPastor) {
            return res.status(403).json({ error: 'Directive Denied: Daily Devotions must be authored by ordained leadership.' });
        }

        // If User is a Pastor (and not High Privilege), check for specific 'DevotionPublishing' module access
        if (isPastor && !isHighPrivilege) {
            const hasModuleAccess = await (prisma as any).pastorModuleAccess.findFirst({
                where: {
                    pastorId: actor.id,
                    moduleKey: 'DevotionPublishing'
                }
            });

            if (!hasModuleAccess) {
                return res.status(403).json({ error: 'Directive Denied: You have not been assigned the Devotion Publishing module.' });
            }
        }

        const devotionDate = new Date(date || new Date());
        devotionDate.setHours(0, 0, 0, 0);

        const devotion = await prisma.devotion.create({
            data: {
                title,
                content,
                themeOfMonth,
                themeOfYear,
                date: devotionDate
            }
        });

        // 🧠 NLP-LITE: AFFIRMATION EXTRACTION
        const affirmationText = extractAffirmationFromContent(content);
        
        // Use UPSERT for Affirmation to prevent 500 on unique constraint failure
        const affirmation = await prisma.affirmation.upsert({
            where: { date: devotionDate },
            update: {
                content: affirmationText,
                devotionId: devotion.id
            },
            create: {
                content: affirmationText,
                date: devotionDate,
                devotionId: devotion.id
            }
        });

        await logAction({
            actorId: actor.id,
            actorRole: actor.role,
            actionType: 'CREATE_DEVOTION',
            entityType: 'DEVOTION',
            entityId: devotion.id,
            afterState: { devotion, affirmation }
        });

        res.json({ success: true, data: { devotion, affirmation } });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getDevotions = async (req: Request, res: Response) => {
    try {
        const devotions = await prisma.devotion.findMany({
            orderBy: { date: 'desc' },
            take: 30,
            include: { affirmations: true }
        });
        res.json({ success: true, data: devotions });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Helper: Extract the most powerful "faith" sentence as an affirmation.
 */
function extractAffirmationFromContent(content: string): string {
    const sentences = content.split(/[.!?]/).filter(s => s.trim().length > 10);
    
    // Keywords indicating affirmation/prophetic statement
    const keywords = ['I am', 'I will', 'You are', 'manifest', 'favor', 'blessed', 'victorious', 'established', 'Word', 'Lord'];
    
    let bestSentence = sentences[0] || "I am walking in divine favor today.";
    let maxMatches = 0;

    for (const sentence of sentences) {
        let matches = 0;
        for (const kw of keywords) {
            if (sentence.toLowerCase().includes(kw.toLowerCase())) matches++;
        }
        if (matches > maxMatches) {
            maxMatches = matches;
            bestSentence = sentence.trim();
        }
    }

    return bestSentence + "!";
}
