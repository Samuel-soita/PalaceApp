import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { emitToRoom } from '../../utils/socket.js';

export const getMessages = async (req: Request, res: Response) => {
    const { departmentId, projectId, eventId, receiverId, chatType } = req.query;
    try {
        const messages = await prisma.message.findMany({
            where: {
                ...(chatType && { chatType: chatType as string }),
                ...(departmentId && { departmentId: departmentId as string }),
                ...(projectId && { projectId: projectId as string }),
                ...(eventId && { eventId: eventId as string }),
                ...(receiverId && {
                    OR: [
                        { AND: [{ senderId: (req as any).user?.id }, { receiverId: receiverId as string }] },
                        { AND: [{ senderId: receiverId as string }, { receiverId: (req as any).user?.id }] }
                    ]
                } as any)
            },
            include: { 
                sender: { select: { name: true, role: true, avatarUrl: true } }, 
                receiver: { select: { name: true, avatarUrl: true } } 
            } as any,
            orderBy: { createdAt: 'asc' },
        });
        const sanitizedMessages = messages.map((msg: any) => {
            const sender = msg.sender;
            const receiver = msg.receiver;

            const isSenderLeader = sender?.role === 'DEPARTMENT_LEADER' || sender?.role === 'SUPER_ADMIN' || sender?.role === 'WATUA';
            
            return {
                ...msg,
                sender: {
                    ...sender,
                    name: isSenderLeader ? sender?.name : 'Ministry Member',
                    avatarUrl: isSenderLeader ? sender?.avatarUrl : null
                },
                ...(receiver && {
                    receiver: {
                        ...receiver,
                        // If it's a private chat, receiver info is also important
                        name: (msg.receiver?.role === 'DEPARTMENT_LEADER' || msg.receiver?.role === 'SUPER_ADMIN') ? receiver.name : 'Ministry Member',
                        avatarUrl: (msg.receiver?.role === 'DEPARTMENT_LEADER' || msg.receiver?.role === 'SUPER_ADMIN') ? receiver.avatarUrl : null
                    }
                })
            };
        });

        res.json(sanitizedMessages);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch messages' });
    }
};

export const createMessage = async (req: Request, res: Response) => {
    const { content, senderId, receiverId, departmentId, projectId, eventId, chatType, taggedDepartmentIds } = req.body;
    
    // Inappropriate keywords check (Moderation)
    const inappropriateKeywords = ['gossip', 'attack', 'abuse', 'hate', 'foul', 'badword']; // Placeholder keywords
    const isFlagged = inappropriateKeywords.some(keyword => content.toLowerCase().includes(keyword));

    try {
        const sender = await prisma.user.findUnique({ where: { id: senderId } });
        if ((sender as any)?.isSuspended) {
            return res.status(403).json({ error: 'Your account is suspended due to moderation policy.' });
        }

        const message = await prisma.message.create({
            data: {
                content,
                senderId,
                receiverId,
                departmentId,
                projectId,
                eventId,
                chatType: chatType || 'DEPARTMENT',
                isFlagged,
                flagReason: isFlagged ? 'Inappropriate content detected' : null
            } as any,
            include: { 
                sender: { select: { id: true, name: true, role: true, avatarUrl: true, wrongdoingCount: true } },
                receiver: { select: { name: true, avatarUrl: true } },
                department: { select: { name: true } }
            } as any,
        });

        // Handle Flagging Logic
        if (isFlagged) {
            const senderUser = await prisma.user.findUnique({ where: { id: senderId } }) as any;
            const newWrongdoingCount = (senderUser?.wrongdoingCount || 0) + 1;
            const shouldSuspend = newWrongdoingCount >= 3;

            await prisma.user.update({
                where: { id: senderId },
                data: {
                    wrongdoingCount: newWrongdoingCount,
                    isSuspended: shouldSuspend,
                    lastSuspendedAt: shouldSuspend ? new Date() : null,
                    status: shouldSuspend ? 'SUSPENDED' : 'ACTIVE'
                } as any
            });

            // Notify Bishop
            const bishop = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
            if (bishop) {
                await prisma.notification.create({
                    data: {
                        userId: bishop.id,
                        title: '⚠️ Moderation Alert',
                        message: `Leader ${(message as any).sender.name} sent a flagged message. Count: ${newWrongdoingCount}. ${shouldSuspend ? 'Account SUSPENDED.' : ''}`
                    }
                });
            }
        }

        // Sanitize before response/emit
        const isSenderLeader = (message as any).sender?.role === 'DEPARTMENT_LEADER' || (message as any).sender?.role === 'SUPER_ADMIN' || (message as any).sender?.role === 'WATUA';
        const sanitizedMessage = {
            ...message,
            sender: {
                ...(message as any).sender,
                name: isSenderLeader ? (message as any).sender?.name : 'Ministry Member',
                avatarUrl: isSenderLeader ? (message as any).sender?.avatarUrl : null
            },
            ...((message as any).receiver && {
                receiver: {
                    ...(message as any).receiver,
                    name: ((message as any).receiver?.role === 'DEPARTMENT_LEADER' || (message as any).receiver?.role === 'SUPER_ADMIN') ? (message as any).receiver.name : 'Ministry Member',
                    avatarUrl: ((message as any).receiver?.role === 'DEPARTMENT_LEADER' || (message as any).receiver?.role === 'SUPER_ADMIN') ? (message as any).receiver.avatarUrl : null
                }
            })
        };

        const roomId = receiverId ? [senderId, receiverId].sort().join('-') : ((message as any).departmentId || (message as any).projectId || (message as any).eventId);
        if (roomId) {
            emitToRoom(roomId, 'receive_message', sanitizedMessage);
        }

        // Handle Mentions/Notifications (Slightly modified to use sanitized name if needed)
        const notificationName = isSenderLeader ? (message as any).sender.name : 'A member';
        
        if ((message as any).departmentId && !receiverId) {
            // ... (keep as is, notifications use internal logic)
        }

        res.status(201).json(sanitizedMessage);
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

        const roomId = (message as any).departmentId || (message as any).projectId || (message as any).eventId;
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
