import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { emitToRoom } from '../../utils/socket.js';

export const getMessages = async (req: Request, res: Response) => {
    const { departmentId, projectId, eventId } = req.query;
    try {
        const messages = await prisma.message.findMany({
            where: {
                ...(departmentId && { departmentId: departmentId as string }),
                ...(projectId && { projectId: projectId as string }),
                ...(eventId && { eventId: eventId as string }),
            },
            include: { sender: { select: { name: true, role: true } } },
            orderBy: { createdAt: 'asc' },
        });
        res.json(messages);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch messages' });
    }
};

export const createMessage = async (req: Request, res: Response) => {
    const { content, senderId, departmentId, projectId, eventId, taggedDepartmentIds } = req.body;
    try {
        const message = await prisma.message.create({
            data: {
                content,
                senderId,
                departmentId,
                projectId,
                eventId,
            },
            include: { 
                sender: { select: { name: true, role: true } },
                department: { select: { name: true } }
            },
        });

        // Broadcast to relevant room
        const roomId = departmentId || projectId || eventId;
        if (roomId) {
            emitToRoom(roomId, 'receive_message', message);
        }

        // Handle Mentions/Notifications
        if (departmentId) {
            const deptLeaders = await prisma.user.findMany({
                where: {
                    AND: [
                        { departmentId: departmentId as string },
                        { role: 'DEPARTMENT_LEADER' }
                    ]
                }
            });

            const deptNotifications = deptLeaders.map(leader => ({
                userId: leader.id,
                title: 'New Department Message',
                message: `New activity in your department chat: "${content.substring(0, 50)}..."`,
            }));

            if (deptNotifications.length > 0) {
                await prisma.notification.createMany({ data: deptNotifications });
            }
        }

        if (taggedDepartmentIds && Array.isArray(taggedDepartmentIds)) {
            for (const deptId of taggedDepartmentIds) {
                // Find potential leaders of this department
                const leaders = await prisma.user.findMany({
                    where: { 
                        OR: [
                            { role: 'SUPER_ADMIN' },
                            { AND: [{ departmentId: deptId }, { role: 'DEPARTMENT_LEADER' }] }
                        ]
                    }
                });

                // Create notifications for them
                const notifications = leaders.map(leader => ({
                    userId: leader.id,
                    title: 'New Department Mention',
                    message: `${message.sender.name} tagged your department in a message: "${content.substring(0, 50)}..."`,
                }));

                if (notifications.length > 0) {
                    await prisma.notification.createMany({ data: notifications });
                }
            }
        }

        res.status(201).json(message);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to create message' });
    }
};

export const updateMessage = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { content } = req.body;
    try {
        const message = await prisma.message.update({
            where: { id },
            // @ts-ignore - Prisma might need a rebuild to see these fields in some IDEs
            data: { content, isEdited: true },
            include: { sender: { select: { name: true, role: true } } },
        });

        const roomId = message.departmentId || message.projectId || message.eventId;
        if (roomId) {
            emitToRoom(roomId, 'message_edited', message);
        }

        res.json(message);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to update message' });
    }
};

export const deleteMessage = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        // Soft delete
        const message = await prisma.message.update({
            where: { id },
            // @ts-ignore
            data: { isDeleted: true, content: 'This message was deleted' },
        });

        const roomId = message.departmentId || message.projectId || message.eventId;
        if (roomId) {
            emitToRoom(roomId, 'message_deleted', { id, roomId });
        }

        res.json(message);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to delete message' });
    }
};
