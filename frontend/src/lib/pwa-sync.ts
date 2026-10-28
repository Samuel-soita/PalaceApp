import { db, SyncJob } from './db';
import api from './api-client';
import { DeviceService } from './DeviceService';
import { handleSessionExpired, isOnlineSessionActive, expireSessionIfNeeded } from './auth-session';

/**
 * Local-first sync daemon — pull server state into Dexie, push syncQueue upstream.
 * Only runs with a valid online JWT; modules sync sequentially to avoid 401 bursts.
 */

const SYNC_INTERVAL_MS = 30_000;
const MIN_SYNC_GAP_MS = 12_000;
const ERROR_THROTTLE_MS = 60_000;

let isSyncing = false;
let lastRunAt = 0;
let pullAborted = false;
let syncDaemonStarted = false;
let syncIntervalId: ReturnType<typeof setInterval> | null = null;
let lastSyncTimestamp = Number(localStorage.getItem('palace-last-sync') || 0);
const recentSyncErrors = new Map<string, number>();

function shouldSkipSync(): boolean {
    if (isSyncing || !navigator.onLine) return true;
    if (typeof document !== 'undefined' && document.hidden) return true;
    if (expireSessionIfNeeded()) return true;
    if (!isOnlineSessionActive()) return true;
    if (Date.now() - lastRunAt < MIN_SYNC_GAP_MS) return true;
    return false;
}

function notifySyncError(path: string, status?: number) {
    if (status === 401) return;
    const key = `${path}:${status ?? 'unknown'}`;
    const last = recentSyncErrors.get(key) ?? 0;
    if (Date.now() - last < ERROR_THROTTLE_MS) return;
    recentSyncErrors.set(key, Date.now());
    window.dispatchEvent(new CustomEvent('pwa-sync-error', {
        detail: { path, status, message: 'Server Error' },
    }));
}

function notifySyncHealthy() {
    window.dispatchEvent(new CustomEvent('pwa-sync-healthy'));
}

function abortPullSync(reason = 'Session expired') {
    pullAborted = true;
    handleSessionExpired(reason);
}

// ─── Per-module delta cursors ────────────────────────────────────────────────
// Each module advances only when its own pull succeeds, using the server's clock
// (response.timestamp) minus an overlap, so device clock skew or a failed module
// can never cause updates to be skipped. Re-pulling the overlap is harmless (bulkPut).
const CURSOR_OVERLAP_MS = 10_000;

function currentUser(): { id?: string; role?: string } | null {
    try {
        return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
        return null;
    }
}

// Bump the version whenever server-side visibility rules widen, so devices re-pull rows they were previously denied.
const CURSOR_VERSION = 'v2';

function cursorStorageKey() {
    return `palace-sync-cursors:${CURSOR_VERSION}:${currentUser()?.id ?? 'anon'}`;
}

function readCursors(): Record<string, string> {
    try {
        return JSON.parse(localStorage.getItem(cursorStorageKey()) || '{}');
    } catch {
        return {};
    }
}

function cursorFor(path: string): string {
    // No cursor yet for this account: pull everything it may see, not just what changed
    // since another account last synced on this device.
    return readCursors()[path] ?? new Date(0).toISOString();
}

function saveCursor(path: string, serverTimestamp?: string) {
    if (!serverTimestamp) return;
    const t = new Date(serverTimestamp).getTime();
    if (Number.isNaN(t)) return;
    const cursors = readCursors();
    cursors[path] = new Date(t - CURSOR_OVERLAP_MS).toISOString();
    localStorage.setItem(cursorStorageKey(), JSON.stringify(cursors));
}

/** Writes live rows, removes soft-deleted ones; a full sync also drops rows the server no longer returns. */
async function applyServerRows(dbTable: any, rows: any[], isFullSync: boolean) {
    const live: any[] = [];
    const deletedIds: string[] = [];
    for (const row of rows) {
        if (!row?.id) continue;
        if (row.deletedAt) deletedIds.push(row.id);
        else live.push({ ...row, syncStatus: 'SYNCED' });
    }
    if (live.length) await dbTable.bulkPut(live);
    if (deletedIds.length) await dbTable.bulkDelete(deletedIds);

    if (isFullSync) {
        const keep = new Set(live.map(r => r.id));
        const stale = await dbTable.filter((r: any) => !keep.has(r.id) && r.syncStatus === 'SYNCED').primaryKeys();
        if (stale.length) await dbTable.bulkDelete(stale);
    }
}

async function syncModule(path: string, dbTable: any, isFullSync = false): Promise<boolean> {
    if (pullAborted || !isOnlineSessionActive()) return false;
    try {
        const res = await api.get(path, isFullSync ? {} : { params: { since: cursorFor(path) } });
        const data = isFullSync ? (res.data.data || res.data) : res.data.data;
        if (Array.isArray(data)) await applyServerRows(dbTable, data, isFullSync);
        if (!isFullSync) saveCursor(path, res.data.timestamp);
        return true;
    } catch (err: any) {
        const status = err.response?.status;
        const isAuthError = status === 401 || err.code === 'SESSION_EXPIRED' || err.code === 'OFFLINE_SESSION';
        if (isAuthError) {
            abortPullSync(err.response?.data?.error || 'Session expired');
            return false;
        }
        console.warn(`[Palace-Daemon] Module sync failed: ${path}`, err.message);
        notifySyncError(path, status);
        return false;
    }
}

interface SyncModuleDef {
    name: string;
    path: string;
    table: any;
    full?: boolean;
}

/** Modules this role pulls, in priority order. `name` matches the server's 'sync-update' module. */
function modulesForRole(role?: string): SyncModuleDef[] {
    const isAdmin = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'WATUA', 'PASTOR'].includes(role ?? '');
    const isLeader = role === 'DEPARTMENT_LEADER';
    const defs: SyncModuleDef[] = [
        { name: 'departments', path: '/departments', table: db.departments, full: true },
        { name: 'events', path: '/sync/events', table: db.events },
        { name: 'announcements', path: '/sync/announcements', table: db.announcements },
        { name: 'plans', path: '/sync/plans', table: db.plans },
        { name: 'meetings', path: '/sync/meetings', table: db.meetings },
        { name: 'projects', path: '/sync/projects', table: db.projects },
        { name: 'partnerships', path: '/sync/partnerships', table: db.partnerships },
    ];
    if (isAdmin || isLeader) {
        defs.push(
            // Chat is leader-only, so members never pull it.
            { name: 'messages', path: '/sync/messages', table: db.messages },
            { name: 'members', path: '/sync/members', table: db.users },
            { name: 'devotions', path: '/sync/devotions', table: db.devotions },
            { name: 'baptisms', path: '/sync/baptisms', table: db.baptisms },
            { name: 'children', path: '/sync/children', table: db.children },
            { name: 'finance', path: '/sync/finance', table: db.transactions },
            { name: 'repairs', path: '/sync/repairs', table: db.repairs },
            { name: 'appointments', path: '/sync/appointments', table: db.appointments },
            { name: 'reports', path: '/sync/reports', table: db.reports },
            { name: 'support_requests', path: '/sync/support_requests', table: db.supportRequests },
        );
        if (role === 'WATUA' || role === 'SUPER_ADMIN') {
            defs.push({ name: 'audit_logs', path: '/sync/audit_logs', table: db.auditLogs });
        }
    }
    return defs;
}

async function runPullSync(only?: Set<string>) {
    pullAborted = false;
    if (!isOnlineSessionActive()) return;

    const defs = modulesForRole(currentUser()?.role).filter(d => !only || only.has(d.name));
    let successes = 0;
    for (const def of defs) {
        if (pullAborted) break;
        if (await syncModule(def.path, def.table, def.full)) successes++;
    }

    if (successes > 0) {
        if (!only) {
            lastSyncTimestamp = Date.now();
            localStorage.setItem('palace-last-sync', lastSyncTimestamp.toString());
        }
        notifySyncHealthy();
    }
}

const pendingTargetedModules = new Set<string>();

/**
 * Pull only the given modules right away (used when the server broadcasts 'sync-update').
 * Requests that arrive while a sync is running are merged and run right after it.
 */
export async function syncModulesNow(moduleNames: string[]) {
    moduleNames.forEach(m => pendingTargetedModules.add(m));
    if (isSyncing || !navigator.onLine || !isOnlineSessionActive() || expireSessionIfNeeded()) return;
    if (typeof document !== 'undefined' && document.hidden) return; // full sync runs on return to the tab

    const batch = new Set(pendingTargetedModules);
    pendingTargetedModules.clear();
    isSyncing = true;
    try {
        await runPullSync(batch);
    } finally {
        isSyncing = false;
    }
    if (pendingTargetedModules.size > 0) void syncModulesNow([]);
}

async function runPushSync() {
    if (!isOnlineSessionActive()) return;

    const deviceId = await DeviceService.getDeviceId();

    try {
        const failedJobs = await db.syncQueue.where('status').equals('FAILED').toArray();
        if (failedJobs.length > 0) {
            await db.syncQueue.where('status').equals('FAILED').modify({ status: 'PENDING', retryCount: 0 });
        }
    } catch (recoverErr) {
        console.error('[Palace-Daemon] Recovery sweep failed', recoverErr);
    }

    const queue = await db.syncQueue.orderBy('timestamp').toArray();

    for (const job of queue) {
        if (pullAborted || !isOnlineSessionActive()) break;
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
                id: _id,
                ...cleanPayload
            } = job.payload;

            const finalHeaders = {
                'X-Device-ID': deviceId,
                'X-Client-Version': job.payload.version?.toString() || '1',
            };

            const finalPayload = cleanPayload;
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
                if (!finalId) {
                    // Nothing local to reconcile.
                } else if (job.payload.id && finalId !== job.payload.id) {
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
                } else if (!job.payload.id) {
                    const existing = await table.get(finalId);
                    await table.put({ ...(existing || {}), ...serverRecord, id: finalId, syncStatus: 'SYNCED' });
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

            if (status === 401 || pushErr?.code === 'SESSION_EXPIRED' || pushErr?.code === 'OFFLINE_SESSION') {
                abortPullSync(pushErr?.response?.data?.error || 'Session expired');
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
        if (!pullAborted) await runPushSync();
    } finally {
        isSyncing = false;
    }
    // Broadcasts that arrived mid-run may postdate what this pull saw.
    if (pendingTargetedModules.size > 0) void syncModulesNow([]);
}

function onOnline() {
    if (isOnlineSessionActive()) setTimeout(processSyncDaemon, 500);
}

function onVisible() {
    if (!document.hidden && isOnlineSessionActive()) setTimeout(processSyncDaemon, 500);
}

function onSessionExpired() {
    stopSyncDaemon();
}

/** Start background sync — only call when a valid online JWT is present. */
export function startSyncDaemon() {
    if (syncDaemonStarted || typeof window === 'undefined') return;
    if (!isOnlineSessionActive()) return;

    syncDaemonStarted = true;
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('auth:session-expired', onSessionExpired);

    syncIntervalId = setInterval(() => {
        if (navigator.onLine && isOnlineSessionActive()) processSyncDaemon();
    }, SYNC_INTERVAL_MS);

    setTimeout(processSyncDaemon, 2000);
}

/** Stop all scheduled sync work (logout / session expired). */
export function stopSyncDaemon() {
    pullAborted = true;
    syncDaemonStarted = false;
    if (syncIntervalId) {
        clearInterval(syncIntervalId);
        syncIntervalId = null;
    }
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('auth:session-expired', onSessionExpired);
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

let flushTimer: ReturnType<typeof setTimeout> | null = null;
export function requestSyncSoon() {
    if (!isOnlineSessionActive()) return;
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
        lastRunAt = 0;
        processSyncDaemon();
    }, 800);
}
