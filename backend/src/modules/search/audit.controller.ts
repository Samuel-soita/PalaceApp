import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';

export const getAuditLogs = async (req: Request, res: Response) => {
    try {
        const logs = await prisma.auditLog.findMany({
            include: {
                actor: {
                    select: { name: true, avatarUrl: true, role: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 10
        });
        res.json(logs);
    } catch (error: any) {
        console.error('[getAuditLogs]', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
};
