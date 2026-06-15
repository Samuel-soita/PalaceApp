import { db, SyncJob } from './db';
import api from './api-client';
import { DeviceService } from './DeviceService';
import { handleSessionExpired, isSessionActive, expireSessionIfNeeded } from './auth-session';

/**
 * Local-first sync daemon — pull server state into Dexie, push syncQueue upstream.
 * Tuned for low CPU/network use: longer interval, tab-aware, batched pulls, throttled errors.
 */

const SYNC_INTERVAL_MS = 30_000;
const MIN_SYNC_GAP_MS = 12_000;
const ERROR_THROTTLE_MS = 60_000;

let isSyncing = false;
let lastRunAt = 0;
let pullAborted = false;
let lastSyncTimestamp = Number(localStorage.getItem('palace-last-sync') || 0);
const recentSyncErrors = new Map<string, number>();

function shouldSkipSync(): boolean {
    if (isSyncing || !navigator.onLine) return true;
    if (typeof document !== 'undefined' && document.hidden) return true;
    if (expireSessionIfNeeded()) return true;
    if (!isSessionActive()) return true;
    if (Date.now() - lastRunAt < MIN_SYNC_GAP_MS) return true;
    return false;
}

function notifySyncError(path: string, status?: number) {
    const key = `${path}:${status ?? 'unknown'}`;
    const last = recentSyncErrors.get(key) ?? 0;
    if (Date.now() - last < ERROR_THROTTLE_MS) return;
    recentSyncErrors.set(key, Date.now());
    window.dispatchEvent(new CustomEvent('pwa-sync-error', {
        detail: { path, status, message: status === 401 ? 'Authentication Required' : 'Server Error' },
    }));
}

function notifySyncHealthy() {
    window.dispatchEvent(new CustomEvent('pwa-sync-healthy'));
}

async function syncModule(
    path: string,
    dbTable: any,
    isFullSync = false,
    sinceQuery: { params: { since: string } }
): Promise<boolean> {
    if (pullAborted || !isSessionActive()) return false;
    try {
        const res = await api.get(path, isFullSync ? {} : sinceQuery);
        const data = isFullSync ? (res.data.data || res.data) : res.data.data;
        if (Array.isArray(data) && data.length) {
            await dbTable.bulkPut(data.map((item: any) => ({ ...item, syncStatus: 'SYNCED' })));
        }
        return true;
    } catch (err: any) {
        const status = err.response?.status;
        const isAuthError = status === 401 || err.code === 'SESSION_EXPIRED';
        if (isAuthError) {
            pullAborted = true;
            if (status === 401) {
                handleSessionExpired(err.response?.data?.error || 'Session expired');
            }
            return false;
        }
        console.warn(`[Palace-Daemon] Module sync failed: ${path}`, err.message);
        notifySyncError(path, status);
        return false;
    }
}

async function runPullSync() {
    pullAborted = false;
    const sinceQuery = { params: { since: new Date(lastSyncTimestamp).toISOString() } };
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const isAdmin = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'WATUA', 'PASTOR'].includes(user?.role);
    const isLeader = user?.role === 'DEPARTMENT_LEADER';

    // Phase 1: infrastructure (sequential — small, required first)
    const infraOk = await syncModule('/departments', db.departments, true, sinceQuery);

    // Phase 2: core comms (batched parallel — max 4 at a time)
    const coreModules: Array<[string, any]> = [
        ['/sync/events', db.events],
        ['/sync/announcements', db.announcements],
        ['/sync/plans', db.plans],
        ['/sync/messages', db.messages],
        ['/sync/meetings', db.meetings],
        ['/sync/projects', db.projects],
    ];

    let coreSuccess = 0;
    for (let i = 0; i < coreModules.length; i += 4) {
        if (pullAborted) break;
        const batch = coreModules.slice(i, i + 4);
        const batchResults = await Promise.all(
            batch.map(([path, table]) => syncModule(path, table, false, sinceQuery))
        );
        coreSuccess += batchResults.filter(Boolean).length;
    }

    if (pullAborted) return;

    // Covenant partnerships — every signed-in user pulls their own record (admins get all)
    const partnershipOk = await syncModule('/sync/partnerships', db.partnerships, false, sinceQuery);

    if (pullAborted) return;

    // Phase 3: secondary modules (only for privileged roles — reduces member load)
    let secondarySuccess = 0;
    if (isAdmin || isLeader) {
        const secondary: Array<[string, any] | null> = [
            (isAdmin || isLeader) ? ['/sync/members', db.users] : null,
            ['/sync/devotions', db.devotions],
            ['/sync/baptisms', db.baptisms],
            ['/sync/children', db.children],
            ['/sync/finance', db.transactions],
            ['/sync/repairs', db.repairs],
            ['/sync/appointments', db.appointments],
            ['/sync/reports', db.reports],
            ['/sync/support_requests', db.supportRequests],
            (user?.role === 'WATUA' || user?.role === 'SUPER_ADMIN') ? ['/sync/audit_logs', db.auditLogs] : null,
        ];

        const active = secondary.filter(Boolean) as Array<[string, any]>;
        for (let i = 0; i < active.length; i += 4) {
            if (pullAborted) break;
            const batch = active.slice(i, i + 4);
            const batchResults = await Promise.all(
                batch.map(([path, table]) => syncModule(path, table, false, sinceQuery))
            );
            secondarySuccess += batchResults.filter(Boolean).length;
        }
    }

    if (infraOk || coreSuccess > 0 || partnershipOk || secondarySuccess > 0) {
        lastSyncTimestamp = Date.now();
        localStorage.setItem('palace-last-sync', lastSyncTimestamp.toString());
        notifySyncHealthy();
    }
}

async function runPushSync() {
    const deviceId = await DeviceService.getDeviceId();

    // Reset previously failed jobs so patched backends can retry automatically
    try {
        const failedJobs = await db.syncQueue.where('status').equals('FAILED').toArray();
        if (failedJobs.length > 0) {
            console.info(`[Palace-Daemon] Found ${failedJobs.length} failed jobs. Attempting auto-recovery reset.`);
            await db.syncQueue.where('status').equals('FAILED').modify({ status: 'PENDING', retryCount: 0 });
        }
    } catch (recoverErr) {
        console.error('[Palace-Daemon] Recovery sweep failed', recoverErr);
    }

    const queue = await db.syncQueue.orderBy('timestamp').toArray();

    for (const job of queue) {
        if (job.status === 'SYNCED' || job.status === 'FAILED') continue;

        if (job.status === 'RETRYING') {
            const backoffMs = Math.pow(2, job.retryCount) * 2000;
            if (Date.now() - job.timestamp < backoffMs) continue;
        }

        try {
            const {
                syncStatus,
                createdAt,
                updatedAt,
                deletedAt,
                id,
                ...cleanPayload
            } = job.payload;

            const finalHeaders = {
                'X-Device-ID': deviceId,
                'X-Client-Version': job.payload.version?.toString() || '1',
            };

            const finalPayload = job.method === 'POST' ? cleanPayload : { ...cleanPayload, id };
            let response;

            if (job.method === 'POST') {
                response = await api.post(job.url, finalPayload, { headers: finalHeaders });
            } else if (job.method === 'PUT') {
                response = await api.put(job.url, finalPayload, { headers: finalHeaders });
            } else if (job.method === 'PATCH') {
                response = await api.patch(job.url, finalPayload, { headers: finalHeaders });
            } else if (job.method === 'DELETE') {
                response = await api.delete(job.url, { headers: finalHeaders });
            }

            const tableMap: Record<string, any> = {
                EVENT: db.events,
                PROJECT: db.projects,
                PLAN: db.plans,
                ANNOUNCEMENT: db.announcements,
                MEETING: db.meetings,
                DEVOTION: db.devotions,
                MESSAGE: db.messages,
                BAPTISM: db.baptisms,
                CHILD: db.children,
                TRANSACTION: db.transactions,
                REPAIR: db.repairs,
                APPOINTMENT: db.appointments,
                PARTNERSHIP: db.partnerships,
                PARTNERSHIP_LEDGER: db.partnershipLedgers,
                AUDIT_LOG: db.auditLogs,
                REPORT: db.reports,
                SUPPORT_REQUEST: db.supportRequests,
                USER: db.users,
            };

            const table = tableMap[job.entity];
            const responseData = response?.data?.data ?? response?.data;

            if (job.entity === 'DEVOTION' && responseData?.affirmation) {
                await db.affirmations.put({ id: 'DAILY', ...responseData.affirmation, syncStatus: 'SYNCED' });
            }

            if (job.entity === 'PARTNERSHIP_LEDGER') {
                const partnership = responseData?.partnership;
                const ledger = responseData?.ledger;
                if (partnership?.id) {
                    await db.partnerships.put({ ...partnership, syncStatus: 'SYNCED' });
                }
                if (ledger?.id) {
                    const localId = job.payload.localId;
                    if (localId && localId !== ledger.id) {
                        await db.partnershipLedgers.delete(localId).catch(() => undefined);
                    }
                    await db.partnershipLedgers.put({ ...ledger, syncStatus: 'SYNCED' });
                }
            } else if (job.entity === 'PARTNERSHIP') {
                const partnership = responseData?.partnership ?? responseData;
                if (partnership?.id) {
                    await db.partnerships.put({ ...partnership, syncStatus: 'SYNCED' });
                }
            } else if (table && job.method !== 'DELETE') {
                const serverRecord = responseData?.devotion ?? responseData;
                const finalId = serverRecord?.id || responseData?.id || job.payload.id;
                if (finalId !== job.payload.id) {
                    const record = await table.get(job.payload.id);
                    if (record) {
                        await table.delete(job.payload.id);
                        await table.put({
                            ...record,
                            ...serverRecord,
                            syncStatus: 'SYNCED',
                            updatedAt: new Date().toISOString(),
                        });
                    }
                } else {
                    await table.update(job.payload.id, {
                        syncStatus: 'SYNCED',
                        version: serverRecord?.version || responseData?.version || job.payload.version || 1,
                        updatedAt: new Date().toISOString(),
                    });
                }
            }

            await db.syncQueue.update(job.id, { status: 'SYNCED', lastError: undefined });
            setTimeout(() => db.syncQueue.delete(job.id), 100);
        } catch (pushErr: any) {
            const status = pushErr?.response?.status;
            const errorMessage = pushErr?.response?.data?.message || pushErr.message;

            if (status === 401 || pushErr?.code === 'SESSION_EXPIRED') {
                pullAborted = true;
                if (status === 401) {
                    handleSessionExpired(pushErr?.response?.data?.error || 'Session expired');
                }
                break;
            }

            if (status === 409) {
                const tableMap: Record<string, any> = { EVENT: db.events, PROJECT: db.projects, USER: db.users };
                const table = tableMap[job.entity];
                if (table) await table.update(job.payload.id, { syncStatus: 'CONFLICT' });
                await db.syncQueue.update(job.id, { status: 'FAILED', lastError: 'CONFLICT' });
                window.dispatchEvent(new CustomEvent('pwa-conflict-detected', {
                    detail: { action: job, serverData: pushErr.response.data },
                }));
                continue;
            }

            if (status >= 500 || status === 429 || !status) {
                const nextRetryCount = job.retryCount + 1;
                if (nextRetryCount < (job.maxRetries ?? 10)) {
                    await db.syncQueue.update(job.id, {
                        status: 'RETRYING',
                        retryCount: nextRetryCount,
                        lastError: errorMessage,
                    });
                } else {
                    await db.syncQueue.update(job.id, { status: 'FAILED', lastError: 'MAX_RETRIES_EXCEEDED' });
                }
                if (!status) break;
                continue;
            }

            await db.syncQueue.update(job.id, { status: 'FAILED', lastError: errorMessage });
        }
    }
}

export async function processSyncDaemon() {
    if (shouldSkipSync()) return;

    isSyncing = true;
    lastRunAt = Date.now();

    try {
        await runPullSync();
        await runPushSync();
    } finally {
        isSyncing = false;
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('online', () => setTimeout(processSyncDaemon, 500));
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) setTimeout(processSyncDaemon, 500);
    });

    setInterval(() => {
        if (navigator.onLine) processSyncDaemon();
    }, SYNC_INTERVAL_MS);

    setTimeout(processSyncDaemon, 1500);
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
        payload: actionData.payload || actionData,
    });
}

export async function getQueuedActions() {
    return db.syncQueue.toArray();
}

/** Force immediate sync after local mutations (debounced). */
let flushTimer: ReturnType<typeof setTimeout> | null = null;
export function requestSyncSoon() {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
        lastRunAt = 0;
        processSyncDaemon();
    }, 800);
}
