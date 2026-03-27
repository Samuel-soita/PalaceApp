import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';

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
        res.json(notification);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to update notification' });
    }
};

export const createNotification = async (userId: string, title: string, message: string) => {
    try {
        return await prisma.notification.create({
            data: { userId, title, message },
        });
    } catch (error) {
        console.error('Failed to create notification', error);
    }
};
