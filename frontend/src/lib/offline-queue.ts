import { queueAction, QueuedAction, getQueuedActions, processQueue } from './pwa-sync';
import { resolveConflict, LocalState, SyncPayload } from './conflict-resolution';

/**
 * 2.4.0 Kernel: Dispatch Command Hub
 * Centralizes all offline-first operations for the PWA.
 */

export const OfflineQueue = {
    /**
     * Dispatch a network request to the offline-supported kernel queue.
     * Guaranteed delivery mechanism.
     */
    async dispatch(url: string, method: 'POST' | 'PATCH' | 'DELETE', payload: any, priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM') {
        const action: Partial<QueuedAction> = {
            url,
            method,
            payload,
            priority,
            headers: {
                // Ensure auth token is picked up if needed
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
            }
        };

        return await queueAction(action);
    },

    /**
     * Re-engage the dispatch engine manually or when explicitly requested.
     */
    async syncNow() {
        if (navigator.onLine) {
            await processQueue();
        } else {
            console.warn('[OfflineQueue] System Offline. Sync Deferred.');
        }
    },

    /**
     * Get the current status of all pending operational actions.
     */
    async getPendingMissions() {
        return await getQueuedActions();
    },

    /**
     * Validate an incoming Delta Sync payload against local offline states.
     * Prevents higher authority data from being overwritten locally.
     */
    resolveDeltaSync(localState: LocalState | null, serverPayload: SyncPayload) {
        return resolveConflict(localState, serverPayload, !navigator.onLine);
    }
};

export default OfflineQueue;
