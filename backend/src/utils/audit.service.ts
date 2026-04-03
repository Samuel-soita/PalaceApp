import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface LogActionParams {
  actorId: string;
  actorRole?: string;
  actionType: string;
  entityType: string;
  entityId?: string;
  beforeState?: any;
  afterState?: any;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Global Immutable Audit Trail
 * Captures precisely who did what, when, and the before/after state delta.
 * Designed to NEVER block the main Node execution thread.
 */
export const logAction = async (params: LogActionParams): Promise<void> => {
  try {
    // Fire and forget - do not await in the controller to avoid blocking
    (prisma as any).auditLog.create({
      data: {
        actorId: params.actorId,
        actorRole: params.actorRole || 'MEMBER',
        actionType: params.actionType,
        entityType: params.entityType,
        entityId: params.entityId,
        beforeState: params.beforeState as any,
        afterState: params.afterState as any,
        metadata: params.metadata as any,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent
      }
    }).catch((err: any) => {
      console.error('[AUDIT LOG FAILURE] Failed to write to audit log:', err);
    });
  } catch (error) {
    // Audit failure should not crash the primary transaction
    console.error('[CRIT] Audit subsystem failure:', error);
  }
};
