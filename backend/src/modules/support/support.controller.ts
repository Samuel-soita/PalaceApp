import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';

// GET all support requests (Bishop/Leaders see all open requests)
export const getSupportRequests = async (req: any, res: Response) => {
    try {
        const requests = await prisma.supportRequest.findMany({
            include: {
                event: { include: { department: true } },
                requester: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(requests);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch support requests' });
    }
};

// Create a support request for an event (must include 1500 minimum + proof image)
export const createSupportRequest = async (req: any, res: Response) => {
    const { eventId, title, description, proofImageUrl } = req.body;

    if (!proofImageUrl) {
        return res.status(400).json({ error: 'Proof of support (screenshot/image) is mandatory.' });
    }

    try {
        // Enforce minimum 1500 shillings
        const supportRequest = await prisma.supportRequest.create({
            data: {
                eventId,
                requesterId: req.user!.id,
                title,
                description,
                amountRequired: 1500,
                proofImageUrl,
                status: 'OPEN'
            },
            include: { event: true, requester: { select: { id: true, name: true } } }
        });

        // Notify all department leaders about the support request
        const leaders = await prisma.user.findMany({
            where: { role: 'DEPARTMENT_LEADER' }
        });

        await prisma.notification.createMany({
            data: leaders.map(leader => ({
                userId: leader.id,
                title: '🤝 Support Request',
                message: `${req.user!.name} is requesting 1,500/- support for event: ${title}`
            }))
        });

        res.status(201).json(supportRequest);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to create support request' });
    }
};

// Approve/fund a support request
export const fundSupportRequest = async (req: any, res: Response) => {
    try {
        const updated = await prisma.supportRequest.update({
            where: { id: req.params.id },
            data: { status: 'FUNDED' }
        });
        res.json(updated);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to update support request' });
    }
};
