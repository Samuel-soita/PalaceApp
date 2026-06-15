import { useMutation, useQueryClient } from '@tanstack/react-query';
import { executeApiFirstMutation } from '../lib/api-first-mutation';
import { db } from '../lib/db';

/**
 * API-first mutation hook — calls the server immediately when online.
 * Local queue + Dexie optimistic writes are used only when offline.
 */
export function useOfflineMutation(options: {
    entity: string;
    table: keyof typeof db;
    url: string;
    updateMethod?: 'PUT' | 'PATCH';
    onSuccess?: () => void;
}) {
    const queryClient = useQueryClient();
    const updateMethod = options.updateMethod || 'PATCH';

    return useMutation(async (payload: any) => {
        const isUpdate = !!payload.id;
        const id = payload.id || crypto.randomUUID();
        const method = isUpdate ? updateMethod : 'POST';
        const endpoint = options.url + (isUpdate ? `/${id}` : '');

        const {
            syncStatus: _syncStatus,
            deviceId: _deviceId,
            lastModifiedBy: _lastModifiedBy,
            version: _version,
            ...cleanPayload
        } = payload;

        return executeApiFirstMutation({
            entity: options.entity,
            method,
            url: endpoint,
            payload: cleanPayload,
            recordId: id,
            table: options.table,
            offlineOptimistic: async (offlineId) => {
                await (db as any)[options.table].put({
                    ...payload,
                    id: offlineId,
                    syncStatus: 'PENDING',
                    updatedAt: new Date().toISOString(),
                });
            },
        });
    }, {
        onSuccess: () => {
            queryClient.invalidateQueries(['dashboard-sync']);
            options.onSuccess?.();
        },
    });
}
