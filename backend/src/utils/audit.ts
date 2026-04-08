import prisma from './prisma.js';

export const logAudit = (
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    details?: any,
    ipAddress?: string,
    userAgent?: string
) => {
    // --- PRODUCTION SCALABILITY: NON-BLOCKING AUDIT ---
    setImmediate(async () => {
        try {
            await (prisma as any).auditLog.create({
                data: {
                    actorId: userId,
                    actorRole: 'SYSTEM',
                    actionType: action,
                    entityType,
                    entityId,
                    metadata: details || {},
                    ipAddress,
                    userAgent
                }
            });
        } catch (error) {
            console.error('[Audit Logger Error]', error);
        }
    });
};
