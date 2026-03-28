import { openDB, IDBPDatabase } from 'idb';
import { queryClient } from './query-client';

/**
 * 🛰️ ENTERPRISE-GRADE DISPATCH ENGINE (OFFLINE-FIRST) - v2.4.0 (Resilience Edition)
 * Mission: 600+ Concurrent Devices, Zero-Latency UI, Binary Resilience
 */

const DB_NAME = 'palace-portal-engine';
const STORE_NAME = 'dispatch-queue';
const CHANNEL_NAME = 'palace-sync-telemetry';
const MAX_QUEUE_SIZE = 2000;
const BATCH_SIZE = 5; // Yield to UI after 5 actions

export type ActionStatus = 'PENDING' | 'RETRYING' | 'FAILED' | 'SYNCED';
export type ActionPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface QueuedAction {
    id: string;
    idempotencyKey: string;
    method: 'POST' | 'PUT' | 'DELETE';
    url: string;
    payload: any;
    headers: Record<string, string>;
    timestamp: number;
    priority: ActionPriority;
    retryCount: number;
    status: ActionStatus;
    errorLog: string[];
    nextRetryTime?: number;
    isBinary?: boolean;
    userRole?: string;
    localId?: string; // For mapping temp IDs to server IDs
}

const syncChannel = new BroadcastChannel(CHANNEL_NAME);
let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, 2, {
            upgrade(db, oldVersion) {
                if (oldVersion < 1) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('by-priority', 'priority');
                    store.createIndex('by-status', 'status');
                    store.createIndex('by-idempotency', 'idempotencyKey');
                }
            },
        });
    }
    return dbPromise;
}

/**
 * 🚀 DISPATCH ACTION TO OFFLINE QUEUE
 */
export async function queueAction(request: Partial<QueuedAction>) {
    const db = await getDB();
    
    // 1. SAFETY LIMIT
    const count = await db.count(STORE_NAME);
    if (count >= MAX_QUEUE_SIZE) {
        console.error('[Palace-Engine] Queue Overflow. Dispatch Aborted.');
        return null;
    }

    // 2. IDEMPOTENCY CHECK (Strict Deduplication mission prevention)
    const idempotencyKey = request.idempotencyKey || 
        `${request.method}-${request.url}-${JSON.stringify(request.payload).length}`;
    
    const existing = await db.getFromIndex(STORE_NAME, 'by-idempotency', idempotencyKey);
    if (existing && existing.status !== 'FAILED') {
        console.warn(`[Palace-Engine] mission collision detected for ${idempotencyKey}. Skipping dispatch.`);
        return existing;
    }
    
    // 3. BINARY DATA BRIDGE (Phase 9 Readiness)
    let payload = request.payload;
    let isBinary = false;
    
    // Future-Proofing: Serialize FormData/Blobs into Base64 for IDB storage
    if (payload instanceof FormData || payload instanceof Blob) {
        console.warn('[Palace-Engine] Binary Payload Detected. Serializing for Phase 9 Bridge...');
        isBinary = true;
        // Placeholder for binary-to-string transformer logic
    }

    const action: QueuedAction = {
        id: crypto.randomUUID(),
        idempotencyKey,
        method: request.method || 'POST',
        url: request.url || '',
        payload,
        headers: { ...request.headers },
        timestamp: Date.now(),
        priority: request.priority || 'MEDIUM',
        retryCount: 0,
        status: 'PENDING',
        errorLog: [],
        isBinary,
        ...request
    };

    await db.put(STORE_NAME, action);
    notifyUI();
    
    // 4. OPTIMISTIC UI (Instant Feedback)
    await applyOptimisticUpdate(action);

    if (navigator.onLine) {
        // Trigger async - don't block the caller
        setTimeout(processQueue, 100);
    }
    
    return action;
}

/**
 * 🧠 OPTIMISTIC STATE MANAGER
 * This ensures the UI reflects the action immediately, even if completely offline.
 */
export async function applyOptimisticUpdate(action: QueuedAction) {
    const { url, payload, method } = action;

    // 1. Determine Query Key based on URL
    let queryKey: string[] | null = null;
    if (url.includes('/announcements')) queryKey = ['dashboard-sync'];
    if (url.includes('/projects')) queryKey = ['dashboard-sync'];
    if (url.includes('/children')) queryKey = ['dashboard-sync'];
    if (url.includes('/partnerships')) queryKey = ['dashboard-sync'];
    
    if (!queryKey) return;

    // 2. Perform Optimistic Mutation
    await queryClient.cancelQueries(queryKey);
    const previousData = queryClient.getQueryData(queryKey);

    if (previousData) {
        queryClient.setQueryData(queryKey, (old: any) => {
            if (!old) return old;
            
            // Shallow Copy
            const updated = { ...old };
            
            // Logic based on endpoint
            if (url.includes('/announcements')) {
                updated.announcements = [
                    { ...payload, id: action.id, createdAt: new Date().toISOString(), status: 'PENDING_SYNC' },
                    ...(updated.announcements || [])
                ];
            }

            if (url.includes('/children')) {
                if (method === 'POST') {
                    updated.children = [
                        { ...payload, id: action.localId || action.id, workflowStatus: 'PENDING_SYNC' },
                        ...(updated.children || [])
                    ];
                }
            }
            
            return updated;
        });
    }
}

export async function getQueuedActions(): Promise<QueuedAction[]> {
    const db = await getDB();
    return db.getAll(STORE_NAME);
}

/**
 * 🔄 REPLAY ENGINE (Self-Healing & Batch-Aware)
 */
export async function processQueue() {
    if (!navigator.onLine || (window as any)._isSyncing) return;
    (window as any)._isSyncing = true;

    try {
        const db = await getDB();
        let actions = await db.getAll(STORE_NAME);
        
        actions = actions.filter(a => 
            a.status !== 'SYNCED' && 
            (!a.nextRetryTime || a.nextRetryTime <= Date.now())
        );

        if (actions.length === 0) return;

        // PRIORITY & ROLE & TIMESTAMP SORT
        const priorityScore: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        const roleScore: Record<string, number> = { 
            SUPER_ADMIN: 0, 
            WATUA: 0, 
            PASTOR: 1, 
            DEPARTMENT_LEADER: 2, 
            MEMBER: 3 
        };
        
        actions.sort((a, b) => {
            const scoreA = priorityScore[a.priority as string] ?? 1;
            const scoreB = priorityScore[b.priority as string] ?? 1;
            if (scoreA !== scoreB) return scoreA - scoreB;

            const rScoreA = roleScore[a.userRole as string] ?? 3;
            const rScoreB = roleScore[b.userRole as string] ?? 3;
            if (rScoreA !== rScoreB) return rScoreA - rScoreB;

            return a.timestamp - b.timestamp;
        });

        console.log(`[Palace-Engine] Syncing missions in batches of ${BATCH_SIZE}...`);

        let processedInThisTick = 0;
        for (const action of actions) {
            // YIELD TO MAIN THREAD (Keep 60FPS) with JITTER
            if (processedInThisTick >= BATCH_SIZE) {
                const yieldJitter = Math.random() * 200;
                console.log(`[Palace-Engine] Batch yield triggered. Sleeping for ${yieldJitter.toFixed(0)}ms...`);
                setTimeout(processQueue, 50 + yieldJitter); 
                return;
            }

            try {
                const targetUrl = action.url.startsWith('http') || action.url.startsWith('/api') 
                    ? action.url 
                    : `/api/${action.url.startsWith('/') ? action.url.slice(1) : action.url}`;

                const response = await fetch(targetUrl, {
                    method: action.method,
                    headers: {
                        ...action.headers,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(action.payload),
                });

                if (response.ok) {
                    await db.delete(STORE_NAME, action.id);
                    processedInThisTick++;
                } else if (response.status >= 500) {
                    await handleRetry(action, `Server Capacity Issue: ${response.status}`);
                } else {
                    action.status = 'FAILED';
                    action.errorLog.push(`Validation Failure: ${response.status}`);
                    await db.put(STORE_NAME, action);
                }
            } catch (err: any) {
                await handleRetry(action, `Network Invisibility: ${err.message}`);
                break; 
            }
        }
    } finally {
        (window as any)._isSyncing = false;
        notifyUI();
    }
}

async function handleRetry(action: QueuedAction, error: string) {
    const db = await getDB();
    action.retryCount++;
    action.errorLog.push(`${new Date().toISOString()}: ${error}`);
    
    if (action.retryCount >= 7) {
        action.status = 'FAILED';
    } else {
        action.status = 'RETRYING';
        
        // JITTERED EXPONENTIAL BACKOFF (Thundering Herd Prevention)
        // Base delay: 2^retryCount * 1s
        // Jitter: random(0, 30s)
        const baseDelay = Math.pow(2, action.retryCount) * 1000;
        const jitter = Math.random() * 30000;
        action.nextRetryTime = Date.now() + baseDelay + jitter;
    }
    
    await db.put(STORE_NAME, action);
}

function notifyUI() {
    getQueuedActions().then(actions => {
        syncChannel.postMessage({
            type: 'SYNC_UPDATE',
            pendingCount: actions.filter(a => a.status !== 'FAILED').length,
            failedCount: actions.filter(a => a.status === 'FAILED').length,
            totalCount: actions.length,
            lastUpdated: Date.now()
        });
    });
}

/**
 * 🛠️ RECOVERY HUB & INTEGRITY SERVICES
 */
export async function cleanupQueue() {
    const db = await getDB();
    const actions = await db.getAll(STORE_NAME);
    const now = Date.now();
    const TTL = 48 * 60 * 60 * 1000; // 48 Hours

    let purged = 0;
    for (const action of actions) {
        const isStale = (now - action.timestamp) > TTL;
        const isBroken = action.retryCount >= 10;
        
        if (isStale || isBroken) {
            await db.delete(STORE_NAME, action.id);
            purged++;
        }
    }
    if (purged > 0) {
        console.warn(`[Palace-Engine] Purged ${purged} stale missions from device terminal.`);
        notifyUI();
    }
}

export async function exportQueue() {
    const actions = await getQueuedActions();
    const data = JSON.stringify(actions, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `palace-dispatch-backup-${new Date().getTime()}.json`;
    a.click();
}

export async function importQueue(json: string) {
    try {
        const actions: QueuedAction[] = JSON.parse(json);
        const db = await getDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        for (const action of actions) {
            await tx.store.put({ ...action, status: 'PENDING', retryCount: 0 });
        }
        await tx.done;
        notifyUI();
        processQueue();
        return true;
    } catch (err) {
        console.error('[Palace-Engine] Import Failure:', err);
        return false;
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        setTimeout(processQueue, Math.random() * 5000);
    });
    // System Self-Healing Tick
    setInterval(cleanupQueue, 60 * 60 * 1000); // Hourly cleanup
    setTimeout(() => {
        cleanupQueue();
        processQueue();
    }, 3000);
}
