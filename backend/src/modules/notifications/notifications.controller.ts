import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { emitNotification } from '../../utils/socket.js';

export const getNotifications = async (req: Request, res: Response) => {
    const { userId } = req.params;
    const actor = (req as any).user;
    if (actor?.id !== userId && actor?.role !== 'WATUA') {
        return res.status(403).json({ error: 'You can only view your own notifications.' });
    }
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
        const existing = await prisma.notification.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Notification not found.' });
        if (existing.userId !== (req as any).user?.id) {
            return res.status(403).json({ error: 'You can only update your own notifications.' });
        }
        const notification = await prisma.notification.update({
            where: { id },
            data: { read: true },
        });
        emitNotification(existing.userId, { id: notification.id, read: true });
        res.json(notification);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to update notification' });
    }
};

