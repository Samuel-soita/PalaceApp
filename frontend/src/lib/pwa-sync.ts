import { db, SyncJob } from './db';
import api from './api-client';

/**
 * TRUE LOCAL-FIRST SYNC DAEMON
 * Runs invisibly in the background. 
 * PULLS state from server -> Hydrates Dexie DB.
 * PUSHES Dexie syncQueue -> Server.
 */

let isSyncing = false;
let lastSyncTimestamp = Number(localStorage.getItem('palace-last-sync') || 0);

export async function processSyncDaemon() {
    if (isSyncing || !navigator.onLine) return;
    
    // Auth Guard: Don't sync if not logged in to avoid 401 spam
    const token = localStorage.getItem('token');
    if (!token) {
        console.debug('[Palace-Daemon] Skipping sync: No active session token found.');
        return;
    }

    isSyncing = true;

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

            const results = await Promise.all([
                syncModule('/sync/events', db.events),
                syncModule('/sync/members', db.users),
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
                syncModule('/sync/partnerships', db.partnerships)
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
        const queue = await db.syncQueue.orderBy('timestamp').toArray();
        for (const job of queue) {
            if (job.status === 'PENDING' || job.status === 'RETRYING') {
                try {
                    let response;
                    
                    // 🛡️ Exhaustive Payload Cleaning for .strict() Backend Schemas
                    // We remove internal sync markers AND server-generated metadata
                    const { 
                        isOfflineSync, 
                        localVersion, 
                        syncStatus, 
                        version, 
                        createdAt, 
                        updatedAt, 
                        deletedAt,
                        id, // Client-side ID usually stripped on POST, preserved on PATCH
                        ...cleanPayload 
                    } = job.payload;
                    
                    // For POST, we strip the client 'id' because backend (Prisma) often auto-generates 
                    // and Zod .strict() fails if 'id' is present in the body.
                    const finalPayload = job.method === 'POST' ? cleanPayload : { ...cleanPayload, id };
                    
                    if (job.method === 'POST') {
                        response = await api.post(job.url, finalPayload);
                    } else if (job.method === 'PATCH') {
                        response = await api.patch(job.url, finalPayload);
                    } else if (job.method === 'DELETE') {
                        response = await api.delete(job.url);
                    }

                    // Successfully synced -> update local entity status to SYNCED
                    // Use a generic update based on the entity-to-table mapping
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
                        'PARTNERSHIP_LEDGER': db.partnershipLedgers
                    };

                    const table = tableMap[job.entity];
                    if (table && job.method !== 'DELETE') {
                        // Use response ID if server generated a new one
                        const finalId = response?.data?.id || job.payload.id;
                        
                        // If ID changed (server-generated), we must swap out the local record
                        if (finalId !== job.payload.id) {
                            const record = await table.get(job.payload.id);
                            if (record) {
                                await table.delete(job.payload.id);
                                await table.put({ 
                                    ...record, 
                                    ...response?.data, 
                                    syncStatus: 'SYNCED', 
                                    version: response?.data?.version || 1 
                                });
                            }
                        } else {
                            await table.update(job.payload.id, { 
                                syncStatus: 'SYNCED', 
                                version: response?.data?.version || job.payload.version 
                            });
                        }
                    }
                    
                    await db.syncQueue.delete(job.id);
                } catch (pushErr: any) {
                    if (pushErr?.response?.status === 409) {
                        // Optimistic Concurrency Conflict
                        if (job.entity === 'EVENT') {
                            await db.events.update(job.payload.id, { syncStatus: 'CONFLICT' });
                        }
                        await db.syncQueue.update(job.id, { status: 'FAILED' });
                        
                        // Fire conflict event for the UI
                        window.dispatchEvent(new CustomEvent('pwa-conflict-detected', {
                            detail: { action: job, serverData: pushErr.response.data }
                        }));
                        isSyncing = false;
                        return; // Halt queue processing until arbitration
                    } else if (pushErr?.response?.status >= 500 || !pushErr.response) {
                        // Network error or 500, trigger jitter backoff
                        const nextRetryCount = job.retryCount + 1;
                        if (nextRetryCount < 10) {
                            await db.syncQueue.update(job.id, { status: 'RETRYING', retryCount: nextRetryCount });
                            const jitter = Math.random() * 1000;
                            const backoff = Math.min((2 ** nextRetryCount) * 1000, 30000) + jitter;
                            console.warn(`[Palace-Daemon] Push failed. Retrying in ${backoff}ms`);
                            setTimeout(processSyncDaemon, backoff);
                        } else {
                            await db.syncQueue.update(job.id, { status: 'FAILED' });
                        }
                        isSyncing = false;
                        return;
                    } else {
                        // 400 Bad Request, permanently fail the job to unblock queue
                        console.error('[Palace-Daemon] Permanent push reject', pushErr);
                        await db.syncQueue.update(job.id, { status: 'FAILED' });
                    }
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
    // Poll every 15 seconds if online to pull updates
    setInterval(() => {
        if (navigator.onLine) processSyncDaemon();
    }, 15000);
    
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
    return db.syncQueue.put({
        id,
        timestamp: Date.now(),
        status: 'PENDING',
        retryCount: 0,
        errorLog: [],
        entity: actionData.entity || 'EVENT',
        method: actionData.method || 'POST',
        url: actionData.url || '',
        payload: actionData.payload || actionData
    });
}

export async function getQueuedActions() {
    return db.syncQueue.toArray();
}
