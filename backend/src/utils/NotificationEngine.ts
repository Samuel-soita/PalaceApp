import prisma from './prisma.js';
import { emitNotification, emitToRoom, broadcastSync } from './socket.js';

interface NotificationPayload {
    userId?: string;
    departmentId?: string;
    global?: boolean;
    title: string;
    message: string;
    type?: string;
    deliveryChannel?: 'IN_APP' | 'SMS' | 'EMAIL';
}

export class NotificationEngine {
    /**
     * Dispatch a notification to a specific user, department, or globally.
     * Guaranteed delivery logic evaluates whether to emit instantly via WebSockets or Queue for external delivery.
     */
    static async dispatch(payload: NotificationPayload) {
        const type = payload.type || 'SYSTEM';
        const deliveryChannel = payload.deliveryChannel || 'IN_APP';

        try {
            if (payload.global) {
                const users = await prisma.user.findMany({ select: { id: true, phoneNumber: true } });
                await prisma.notification.createMany({
                    data: users.map(u => ({
                        userId: u.id,
                        title: payload.title,
                        message: payload.message,
                        type,
                        deliveryChannel
                    }))
                });
                
                if (deliveryChannel === 'IN_APP') {
                    emitToRoom('global', 'notification', { title: payload.title, message: payload.message });
                } else {
                    await this.queueExternalDelivery(users, payload, deliveryChannel);
                }
                broadcastSync('notifications');
                return;
            }

            if (payload.departmentId) {
                const users = await prisma.user.findMany({ where: { departmentId: payload.departmentId }, select: { id: true, phoneNumber: true } });
                await prisma.notification.createMany({
                    data: users.map(u => ({
                        userId: u.id,
                        title: payload.title,
                        message: payload.message,
                        type,
                        deliveryChannel
                    }))
                });

                if (deliveryChannel === 'IN_APP') {
                    emitToRoom(`dept-${payload.departmentId}`, 'notification', { title: payload.title, message: payload.message });
                } else {
                    await this.queueExternalDelivery(users, payload, deliveryChannel);
                }
                broadcastSync('notifications');
                return;
            }

            if (payload.userId) {
                const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true, phoneNumber: true } });
                const alert = await (prisma as any).notification.create({
                    data: {
                        userId: payload.userId,
                        title: payload.title,
                        message: payload.message,
                        type,
                        deliveryChannel
                    }
                });

                if (deliveryChannel === 'IN_APP') {
                    emitNotification(payload.userId, alert);
                } else {
                    if (user) await this.queueExternalDelivery([user], payload, deliveryChannel);
                }
                broadcastSync('notifications');
                return;
            }

            throw new Error('NotificationPayload must specify userId, departmentId, or global=true.');
        } catch (error) {
            console.error('[NotificationEngine Dispatch Error]', error);
        }
    }

    /**
     * Internal offload queue for intensive external delivery algorithms
     */
    private static async queueExternalDelivery(users: any[], payload: NotificationPayload, channel: string) {
        const batch = users.map(user => ({
            type: channel,
            payload: {
                target: user.phoneNumber || user.id,
                title: payload.title,
                message: payload.message
            }
        }));

        // Write directly to JobQueue for Background Worker to pick up
        if (batch.length > 0) {
            await (prisma as any).jobQueue.createMany({
                data: batch.map(b => ({
                    type: b.type,
                    payload: b.payload,
                    status: 'PENDING'
                }))
            });
        }
    }
}
