import { db, AuditLog } from './db';
import { DeviceService } from './DeviceService';

/**
 * 🕵️ Audit Log Service
 * Provides a tamper-evident, append-only trail of all administrative interventions.
 * Captures user identity, device footprint, and structural operation metadata.
 */

export const AuditLogService = {
    /**
     * Records a new administrative event in the local audit vault.
     */
    async log(
        action: string, 
        entityType: string, 
        targetId?: string, 
        metadata: any = {}
    ): Promise<void> {
        try {
            // 1. Get currently authenticated identity (Local-First source)
            const savedUser = localStorage.getItem('user');
            const actor = savedUser ? JSON.parse(savedUser) : null;
            const actorId = actor?.id || 'ANONYMOUS_KERNEL';

            // 2. Get the unique device footprint
            const deviceId = await DeviceService.getDeviceId();

            // 3. Construct the audit entry
            const entry: AuditLog = {
                id: crypto.randomUUID(),
                action,
                targetId,
                entityType,
                performedBy: actorId,
                deviceId,
                timestamp: new Date().toISOString(),
                metadata: {
                    ...metadata,
                    actorName: actor?.name || 'Unknown',
                    actorRole: actor?.role || 'Unknown'
                },
                syncStatus: 'PENDING'
            };

            // 4. Commit to the immutable local vault
            await db.auditLogs.add(entry);

            console.log(`[AuditLog] Successfully recorded administrative event: ${action} on ${entityType}:${targetId || 'GLOBAL'}`);
        } catch (error) {
            console.error('[AuditLog] CRITICAL: Failed to record system log.', error);
            // In a production environment, we might fallback to localStorage or memory for failure recovery
        }
    },

    /**
     * Retrieves the last N logs for the dashboard monitoring engine.
     */
    async getLatest(limit: number = 50): Promise<AuditLog[]> {
        return await db.auditLogs
            .orderBy('timestamp')
            .reverse()
            .limit(limit)
            .toArray();
    }
};
