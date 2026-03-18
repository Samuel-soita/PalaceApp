import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'prayer-palace-sync';
const STORE_NAME = 'actions';

export interface QueuedAction {
    id: string;
    url: string;
    method: 'POST' | 'PUT' | 'DELETE';
    data: any;
    headers: any;
    timestamp: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, 1, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            },
        });
    }
    return dbPromise;
}

export async function queueAction(action: Omit<QueuedAction, 'id' | 'timestamp'>) {
    const db = await getDB();
    const id = crypto.randomUUID();
    const timestamp = Date.now();
    const fullAction: QueuedAction = { ...action, id, timestamp };
    
    await db.put(STORE_NAME, fullAction);
    console.log(`[PWA-Sync] Action queued: ${action.method} ${action.url}`, fullAction);
    
    // Attempt sync immediately if we might be online (though usually called when offline)
    if (navigator.onLine) {
        processQueue();
    }
    
    return fullAction;
}

export async function getQueuedActions(): Promise<QueuedAction[]> {
    const db = await getDB();
    return db.getAll(STORE_NAME);
}

export async function processQueue() {
    if (!navigator.onLine) return;
    
    const db = await getDB();
    const actions = await db.getAll(STORE_NAME);
    
    if (actions.length === 0) return;
    
    console.log(`[PWA-Sync] Processing queue: ${actions.length} actions pending.`);
    
    // Sort by timestamp to preserve order
    actions.sort((a, b) => a.timestamp - b.timestamp);
    
    for (const action of actions) {
        try {
            const response = await fetch(action.url, {
                method: action.method,
                headers: {
                    ...action.headers,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(action.data),
            });
            
            if (response.ok) {
                await db.delete(STORE_NAME, action.id);
                console.log(`[PWA-Sync] Action synced successfully: ${action.id}`);
            } else {
                console.warn(`[PWA-Sync] Action failed with status ${response.status}: ${action.id}. Will retry later.`);
                // Stop processing to maintain order if a dependency exists, 
                // but for general church app actions, we might continue.
                // For now, let's stop on first failure to be safe.
                break;
            }
        } catch (error) {
            console.error(`[PWA-Sync] Network error during sync of ${action.id}:`, error);
            break;
        }
    }
}

// Global listener for online event
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log('[PWA-Sync] System online, triggering sync...');
        processQueue();
    });
}
