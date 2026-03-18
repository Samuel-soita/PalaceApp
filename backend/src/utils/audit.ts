import prisma from './prisma.js';

export const logAudit = (
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    details?: any
) => {
    // --- PRODUCTION SCALABILITY: NON-BLOCKING AUDIT ---
    // Offload to next tick to avoid blocking the main thread/response.
    setImmediate(async () => {
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
        }
    });
};
