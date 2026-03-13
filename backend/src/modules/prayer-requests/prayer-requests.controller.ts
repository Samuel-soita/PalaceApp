import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';

export const getPrayerRequests = async (req: Request, res: Response) => {
    try {
        const requests = await prisma.prayerRequest.findMany({
            include: { requester: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json(requests);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch prayer requests' });
    }
};

export const createPrayerRequest = async (req: AuthRequest, res: Response) => {
    const { content, privacyLevel, assignedTeam } = req.body;
    try {
        const prayerRequest = await prisma.prayerRequest.create({
            data: {
                content,
                privacyLevel,
                assignedTeam,
                requesterId: req.user!.id,
            },
        });
        res.status(201).json(prayerRequest);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to create prayer request' });
    }
};

export const updatePrayerRequest = async (req: Request, res: Response) => {
    try {
        const prayerRequest = await prisma.prayerRequest.update({
            where: { id: req.params.id },
            data: req.body,
        });
        res.json(prayerRequest);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to update prayer request' });
    }
};

export const deletePrayerRequest = async (req: Request, res: Response) => {
    try {
        await prisma.prayerRequest.delete({ where: { id: req.params.id } });
        res.json({ message: 'Prayer request deleted successfully' });
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to delete prayer request' });
    }
};
