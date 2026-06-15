import api from './api-client';
import { db } from './db';
import { queueAction, requestSyncSoon } from './pwa-sync';

export type ApiFirstMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiFirstMutationConfig {
    entity: string;
    method: ApiFirstMethod;
    url: string;
    payload?: Record<string, any>;
    recordId?: string;
    table?: keyof typeof db;
    /** Optimistic Dexie write — only when offline */
    offlineOptimistic?: (id: string) => Promise<void>;
    pickRecord?: (data: any) => any;
}

function defaultPickRecord(data: any) {
    if (!data || typeof data !== 'object') return data;
    return (
        data.devotion
        ?? data.announcement
        ?? data.event
        ?? data.project
        ?? data.plan
        ?? data.message
        ?? data.meeting
        ?? data.repair
        ?? data.report
        ?? data.appointment
        ?? data.partnership
        ?? data.child
        ?? data.supportRequest
        ?? data
    );
}

async function persistSyncedRecord(table: keyof typeof db, record: any, fallbackId?: string) {
    const finalId = record?.id || fallbackId;
    if (!finalId) return;
    await (db as any)[table].put({ ...record, id: finalId, syncStatus: 'SYNCED' });
}

async function callApi(method: ApiFirstMethod, url: string, payload?: Record<string, any>) {
    switch (method) {
        case 'POST':
            return api.post(url, payload);
        case 'PUT':
            return api.put(url, payload);
        case 'PATCH':
            return api.patch(url, payload);
        case 'DELETE':
            return api.delete(url);
    }
}

/**
 * Online: hit API immediately, persist server truth to Dexie, then pull deltas.
 * Offline: optimistic local write + sync queue (fallback only).
 */
export async function executeApiFirstMutation(config: ApiFirstMutationConfig) {
    const {
        entity,
        method,
        url,
        payload = {},
        recordId,
        table,
        offlineOptimistic,
        pickRecord = defaultPickRecord,
    } = config;

    const id = recordId || payload.id;

    if (navigator.onLine) {
        const response = await callApi(method, url, method === 'DELETE' ? undefined : payload);
        const body = response?.data;
        const record = pickRecord(body?.data ?? body);

        if (table) {
            if (method === 'DELETE' && id) {
                await (db as any)[table].delete(id);
            } else if (record && typeof record === 'object') {
                await persistSyncedRecord(table, record, id);
            } else if (method !== 'DELETE') {
                await persistSyncedRecord(table, { ...payload, id: id || crypto.randomUUID() }, id);
            }
        }

        if (entity === 'DEVOTION') {
            const affirmation = body?.affirmation ?? record?.affirmation;
            const devotionRecord = record && typeof record === 'object' ? record : null;
            if (devotionRecord) {
                await db.devotions.put({ id: 'DAILY', ...devotionRecord, syncStatus: 'SYNCED' });
            }
            if (affirmation) {
                await db.affirmations.put({ id: 'DAILY', ...affirmation, syncStatus: 'SYNCED' });
            }
        }

        requestSyncSoon();
        return response;
    }

    const offlineId = id || crypto.randomUUID();

    if (offlineOptimistic) {
        await offlineOptimistic(offlineId);
    } else if (table) {
        if (method === 'DELETE') {
            await (db as any)[table].delete(offlineId);
        } else {
            await (db as any)[table].put({
                ...payload,
                id: offlineId,
                syncStatus: 'PENDING',
                updatedAt: new Date().toISOString(),
            });
        }
    }

    await queueAction({
        entity,
        method,
        url,
        payload: { ...payload, id: offlineId },
    });

    requestSyncSoon();
    return { data: { _queued: true, id: offlineId } };
}
