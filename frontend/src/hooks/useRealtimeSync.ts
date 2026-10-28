import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { socket, connectSocket, disconnectSocket } from '../utils/socket';
import { syncModulesNow, requestSyncSoon } from '../lib/pwa-sync';

/**
 * Substrings of react-query keys affected by each server module. Matching is by
 * substring so new queries ('my-events', 'global-announcements', ...) are covered
 * without registering them here.
 */
const MODULE_QUERY_HINTS: Record<string, string[]> = {
    events: ['event', 'calendar'],
    announcements: ['announcement'],
    plans: ['plan'],
    projects: ['project'],
    meetings: ['meeting'],
    messages: ['message'],
    devotions: ['devotion'],
    members: ['user', 'member', 'personnel', 'pastor'],
    children: ['child', 'dedication'],
    baptisms: ['baptism'],
    finance: ['transaction', 'account', 'finance', 'ledger'],
    budgets: ['budget'],
    repairs: ['repair'],
    appointments: ['appointment'],
    partnerships: ['partner'],
    departments: ['department'],
    reports: ['report'],
    support_requests: ['support'],
    settings: ['setting'],
    permissions: ['permission'],
    notifications: ['notification'],
    dashboard: ['dashboard', 'stats', 'insight', 'summary', 'metric', 'analytics', 'overview'],
};

/**
 * Keeps every open dashboard current: the server broadcasts 'sync-update' after each
 * successful mutation; we re-pull just those modules into Dexie (live queries re-render)
 * and refetch matching active react-query queries.
 */
export function useRealtimeSync() {
    const { user, token } = useAuth();
    const queryClient = useQueryClient();
    const isOnlineToken = !!token && !token.startsWith('offline_token_');

    useEffect(() => {
        if (!user?.id || !isOnlineToken) return;

        connectSocket(user.id);

        const pending = new Set<string>();
        let timer: ReturnType<typeof setTimeout> | null = null;

        const flush = () => {
            timer = null;
            const modules = [...pending];
            pending.clear();
            void syncModulesNow(modules);
            const hints = modules.flatMap(m => MODULE_QUERY_HINTS[m] ?? [m]);
            queryClient.invalidateQueries({
                predicate: (q) => {
                    const key = q.queryKey[0];
                    return typeof key === 'string' && hints.some(h => key.toLowerCase().includes(h));
                },
            });
        };

        const onSyncUpdate = (payload: { module?: string }) => {
            if (!payload?.module) return;
            pending.add(payload.module);
            // Jitter spreads the re-pull of hundreds of clients over ~3s so one change cannot spike the server.
            if (!timer) timer = setTimeout(flush, 250 + Math.random() * 2750);
        };

        let connectedBefore = socket.connected;
        const onConnect = () => {
            // Broadcasts sent while disconnected were missed: catch up fully.
            if (connectedBefore) {
                requestSyncSoon();
                queryClient.invalidateQueries();
            }
            connectedBefore = true;
        };

        socket.on('sync-update', onSyncUpdate);
        socket.on('connect', onConnect);
        return () => {
            socket.off('sync-update', onSyncUpdate);
            socket.off('connect', onConnect);
            if (timer) clearTimeout(timer);
        };
    }, [user?.id, isOnlineToken, queryClient]);

    useEffect(() => {
        if (!user) disconnectSocket();
    }, [user]);
}
