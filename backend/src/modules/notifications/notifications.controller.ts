import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { broadcastSync } from '../../utils/socket.js';

export const getNotifications = async (req: Request, res: Response) => {
    const { userId } = req.params;
    try {
        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        res.json(notifications);
    } catch (error: any) {
        console.error('[Notifications ERROR]', { userId, error: error.message, stack: error.stack });
        res.status(500).json({ error: error.message || 'Failed to fetch notifications' });
    }
};

export const markAsRead = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const notification = await prisma.notification.update({
            where: { id },
            data: { read: true },
        });
        broadcastSync('notifications');
        res.json(notification);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to update notification' });
    }
};

