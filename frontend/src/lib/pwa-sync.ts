import { db, SyncJob } from './db';
import api from './api-client';
import { DeviceService } from './DeviceService';

/**
 * TRUE LOCAL-FIRST SYNC DAEMON
 * Runs invisibly in the background. 
 * PULLS state from server -> Hydrates Dexie DB.
 * PUSHES Dexie syncQueue -> Server.
 */

let isSyncing = false;
let lastSyncTimestamp = Number(localStorage.getItem('palace-last-sync') || 0);
let hasAttemptedRecovery = false;

export async function processSyncDaemon() {
    if (isSyncing || !navigator.onLine) return;
    
    // Auth Guard: Don't sync if not logged in to avoid 401 spam
    const token = localStorage.getItem('token');
    if (!token) {
        console.debug('[Palace-Daemon] Skipping sync: No active session token found.');
        return;
    }

    isSyncing = true;

    // --- AUTO-RECOVERY: RESET FAILED JOBS ON STARTUP ---
    // If the backend was patched, we want previously blocked (400) items to retry automatically,
    // but ONLY once per application load, otherwise it creates an infinite retry loop.
    if (!hasAttemptedRecovery) {
        hasAttemptedRecovery = true;
        try {
            const failedJobs = await db.syncQueue.where('status').equals('FAILED').toArray();
            if (failedJobs.length > 0) {
                console.info(`[Palace-Daemon] Found ${failedJobs.length} failed jobs. Attempting auto-recovery reset.`);
                await db.syncQueue.where('status').equals('FAILED').modify({ status: 'PENDING', retryCount: 0 });
            }
        } catch (recoverErr) {
            console.error('[Palace-Daemon] Recovery sweep failed', recoverErr);
        }
    }

    try {
        // 1. PULL DOWNSTREAM 
        // Sync full records if online and pull any updates
        try {
            const sinceQuery = { params: { since: new Date(lastSyncTimestamp).toISOString() } };
            
            const syncModule = async (path: string, dbTable: any, isFullSync: boolean = false) => {
                try {
                    const res = await api.get(path, isFullSync ? {} : sinceQuery);
                    const data = isFullSync ? (res.data.data || res.data) : res.data.data;
                    if (data?.length) {
                        await dbTable.bulkPut(data.map((item: any) => ({ ...item, syncStatus: 'SYNCED' })));
                        return true;
                    }
                    return false;
                } catch (err: any) {
                    console.error(`[Palace-Daemon] Module sync failed: ${path}`, err.message);
                    window.dispatchEvent(new CustomEvent('pwa-sync-error', { 
                        detail: { path, message: err.message, status: err.response?.status } 
                    }));
                    return false;
                }
            };

            // Load user to check permissions
            const userStr = localStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            const isAdmin = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'WATUA', 'PASTOR'].includes(user?.role);
            const isLeader = user?.role === 'DEPARTMENT_LEADER';

            const results = await Promise.all([
                syncModule('/sync/events', db.events),
                (isAdmin || isLeader) ? syncModule('/sync/members', db.users) : Promise.resolve(true),
                syncModule('/departments', db.departments, true),
                syncModule('/sync/projects', db.projects),
                syncModule('/sync/plans', db.plans),
                syncModule('/sync/announcements', db.announcements),
                syncModule('/sync/devotions', db.devotions),
                syncModule('/sync/meetings', db.meetings),
                syncModule('/sync/messages', db.messages),
                syncModule('/sync/baptisms', db.baptisms),
                syncModule('/sync/children', db.children),
                syncModule('/sync/finance', db.transactions),
                syncModule('/sync/repairs', db.repairs),
                syncModule('/sync/appointments', db.appointments),
                syncModule('/sync/partnerships', db.partnerships),
                syncModule('/sync/reports', db.reports),
                syncModule('/sync/support_requests', db.supportRequests),
                (user?.role === 'WATUA' || user?.role === 'SUPER_ADMIN') ? syncModule('/sync/audit_logs', db.auditLogs) : Promise.resolve(true)
            ]);

            // Only update sync timestamp if at least one core module succeeded
            if (results.some(r => r)) {
                const timestamp = Date.now();
                lastSyncTimestamp = timestamp;
                localStorage.setItem('palace-last-sync', timestamp.toString());
            }
        } catch (pullErr) {
            console.error('[Palace-Daemon] Critical pull failure', pullErr);
        }

        // 2. PUSH UPSTREAM
        // Drain local Dexie syncQueue sequentially
        const deviceId = await DeviceService.getDeviceId();
        const queue = await db.syncQueue.orderBy('timestamp').toArray();
        
        for (const job of queue) {
            // Already synced or too many failures
            if (job.status === 'SYNCED' || job.status === 'FAILED') continue;

            // Exponential Backoff calculation: 2^retryCount * 2000ms
            if (job.status === 'RETRYING') {
                const backoffMs = Math.pow(2, job.retryCount) * 2000;
                if (Date.now() - job.timestamp < backoffMs) {
                    console.debug(`[Palace-Daemon] Skipping job ${job.id}: Within backoff window.`);
                    continue;
                }
            }

            try {
                let response;
                
                // 🛡️ Exhaustive Payload Cleaning
                const { 
                    syncStatus, 
                    createdAt, 
                    updatedAt, 
                    deletedAt,
                    id,
                    ...cleanPayload 
                } = job.payload;
                
                // Add device and version context to request headers
                const finalHeaders = {
                    'X-Device-ID': deviceId,
                    'X-Client-Version': job.payload.version?.toString() || '1'
                };

                const finalPayload = job.method === 'POST' ? cleanPayload : { ...cleanPayload, id };
                
                if (job.method === 'POST') {
                    response = await api.post(job.url, finalPayload, { headers: finalHeaders });
                } else if (job.method === 'PATCH' || job.method === 'PUT') {
                    response = await api.patch(job.url, finalPayload, { headers: finalHeaders });
                } else if (job.method === 'DELETE') {
                    response = await api.delete(job.url, { headers: finalHeaders });
                }

                // Successfully synced -> update local entity status to SYNCED
                const tableMap: Record<string, any> = {
                    'EVENT': db.events,
                    'PROJECT': db.projects,
                    'PLAN': db.plans,
                    'ANNOUNCEMENT': db.announcements,
                    'MEETING': db.meetings,
                    'DEVOTION': db.devotions,
                    'MESSAGE': db.messages,
                    'BAPTISM': db.baptisms,
                    'CHILD': db.children,
                    'TRANSACTION': db.transactions,
                    'REPAIR': db.repairs,
                    'APPOINTMENT': db.appointments,
                    'PARTNERSHIP': db.partnerships,
                    'PARTNERSHIP_LEDGER': db.partnershipLedgers,
                    'AUDIT_LOG': db.auditLogs,
                    'REPORT': db.reports,
                    'SUPPORT_REQUEST': db.supportRequests,
                    'USER': db.users // For promoting/demoting
                };

                const table = tableMap[job.entity];
                if (table && job.method !== 'DELETE') {
                    const finalId = response?.data?.id || job.payload.id;
                    
                    if (finalId !== job.payload.id) {
                        const record = await table.get(job.payload.id);
                        if (record) {
                            await table.delete(job.payload.id);
                            await table.put({ 
                                ...record, 
                                ...response?.data, 
                                syncStatus: 'SYNCED',
                                updatedAt: new Date().toISOString()
                            });
                        }
                    } else {
                        await table.update(job.payload.id, { 
                            syncStatus: 'SYNCED', 
                            version: response?.data?.version || job.payload.version || 1,
                            updatedAt: new Date().toISOString()
                        });
                    }
                }
                
                // Update queue job status
                await db.syncQueue.update(job.id, { 
                    status: 'SYNCED', 
                    lastError: undefined 
                });
                
                // Cleanup synced jobs after a small delay to avoid race conditions
                setTimeout(() => db.syncQueue.delete(job.id), 100);

            } catch (pushErr: any) {
                const status = pushErr?.response?.status;
                const errorMessage = pushErr?.response?.data?.message || pushErr.message;

                if (status === 409) {
                    // CONFLICT: Mark source record for resolution
                    const tableMap: Record<string, any> = { 'EVENT': db.events, 'PROJECT': db.projects, 'USER': db.users };
                    const table = tableMap[job.entity];
                    if (table) await table.update(job.payload.id, { syncStatus: 'CONFLICT' });

                    await db.syncQueue.update(job.id, { status: 'FAILED', lastError: 'CONFLICT' });
                    
                    window.dispatchEvent(new CustomEvent('pwa-conflict-detected', {
                        detail: { action: job, serverData: pushErr.response.data }
                    }));
                    continue; // Process next updates instead of blocking
                } else if (status >= 500 || status === 429 || !status) {
                    // RETRYABLE ERROR
                    const nextRetryCount = job.retryCount + 1;
                    if (nextRetryCount < (job.maxRetries ?? 10)) {
                        await db.syncQueue.update(job.id, { 
                            status: 'RETRYING', 
                            retryCount: nextRetryCount,
                            lastError: errorMessage 
                        });
                        console.warn(`[Palace-Daemon] Push failed. Job ${job.id} queued for backoff retry ${nextRetryCount}/${job.maxRetries}`);
                    } else {
                        await db.syncQueue.update(job.id, { status: 'FAILED', lastError: 'MAX_RETRIES_EXCEEDED' });
                    }
                    if (!status) {
                        break; // Stop completely on network loss
                    } else {
                        continue; // Continue processing other updates
                    }
                } else {
                    // PERMANENT REJECT (400, 403, 404, etc)
                    console.error('[Palace-Daemon] Permanent push reject', pushErr);
                    await db.syncQueue.update(job.id, { status: 'FAILED', lastError: errorMessage });
                    continue; // Continue processing other updates
                }
            }
        }
    } finally {
        isSyncing = false;
    }
}

// Start Daemon Loop
if (typeof window !== 'undefined') {
    window.addEventListener('online', processSyncDaemon);
    // Poll every 5 seconds if online to pull updates
    setInterval(() => {
        if (navigator.onLine) processSyncDaemon();
    }, 5000);
    
    // Initial boot kick
    setTimeout(processSyncDaemon, 2000);
}

export const processQueue = processSyncDaemon;

export interface QueuedAction extends Partial<SyncJob> {
    priority?: 'HIGH' | 'MEDIUM' | 'LOW';
    headers?: Record<string, string>;
}

export async function queueAction(actionData: any) {
    const id = actionData.id || crypto.randomUUID();
    const deviceId = await DeviceService.getDeviceId();
    
    return db.syncQueue.put({
        id,
        timestamp: Date.now(),
        status: 'PENDING',
        retryCount: 0,
        maxRetries: 10,
        deviceId,
        entity: actionData.entity || 'EVENT',
        method: actionData.method || 'POST',
        url: actionData.url || '',
        payload: actionData.payload || actionData
    });
}

export async function getQueuedActions() {
    return db.syncQueue.toArray();
}
