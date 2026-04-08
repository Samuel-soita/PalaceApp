import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/db';
import { queueAction } from '../lib/pwa-sync';
import api from '../lib/api-client';

/**
 * 🛠️ MISSION-CRITICAL MUTATION HOOK
 * Handles zero-network data persistence by dual-writing to 
 * the local Tactical Cache (Dexie) and the Sync Queue.
 */
export function useOfflineMutation(options: {
    entity: string;
    table: keyof typeof db;
    url: string;
    onSuccess?: () => void;
}) {
    const queryClient = useQueryClient();

    return useMutation(async (payload: any) => {
        const isUpdate = !!payload.id;
        const id = payload.id || crypto.randomUUID();
        const finalPayload = { 
            ...payload, 
            id, 
            syncStatus: 'PENDING',
            updatedAt: new Date().toISOString() 
        };

        // 1. OPTIMISTIC TACTICAL PERSISTENCE
        // Update the local database immediately so the UI reflects the change.
        if (typeof (db as any)[options.table]?.put === 'function') {
            await (db as any)[options.table].put(finalPayload);
        }

        // 2. QUEUE FOR GLOBAL SYNC
        // Add to the backend dispatch queue. The PWA Daemon will handle the rest.
        await queueAction({
            id,
            entity: options.entity,
            method: isUpdate ? 'PATCH' : 'POST',
            url: options.url + (isUpdate ? `/${id}` : ''),
            payload: finalPayload
        });

        // 3. ATTEMPT REAL-TIME SYNC IF ONLINE (Optional/Graceful)
        if (navigator.onLine) {
            try {
                const method = isUpdate ? 'patch' : 'post';
                const endpoint = options.url + (isUpdate ? `/${id}` : '');
                await (api as any)[method](endpoint, finalPayload);
                
                // If successful, mark as synced locally
                if (typeof (db as any)[options.table]?.update === 'function') {
                    await (db as any)[options.table].update(id, { syncStatus: 'SYNCED' });
                }
            } catch (err) {
                console.warn('[Palace-Sync] Direct sync failed, job remains in tactical queue.', err);
            }
        }

        return finalPayload;
    }, {
        onSuccess: () => {
            // Invalidate relevant queries to refresh UI from local cache
            queryClient.invalidateQueries(['dashboard-sync']);
            if (options.onSuccess) options.onSuccess();
        }
    });
}
