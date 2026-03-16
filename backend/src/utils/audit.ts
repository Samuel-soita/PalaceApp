import prisma from './prisma.js';

export const logAudit = async (
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    details?: any
) => {
    try {
        await prisma.auditLog.create({
            data: {
                userId,
                action,
                entityType,
                entityId,
                details: details ? JSON.stringify(details) : null,
            }
        });
    } catch (error) {
        console.error('[Audit Logger Error]', error);
        // We typically don't throw here to prevent blocking the main request cycle.
    }
};
