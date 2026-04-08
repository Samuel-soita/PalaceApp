import { useQuery } from '@tanstack/react-query';
import api from '../lib/api-client';
import { db } from '../lib/db';
import { useAuth } from '../contexts/AuthContext';

/**
 * 🛰️ LOCAL-FIRST DASHBOARD ENGINE
 * Priority 1: Dexie DB (Tactical Local Cache)
 * Priority 2: API Sync (Strategic Global State)
 * 
 * Ensures the Bishop and Admins have 100% data availability even when offline.
 */
export function useLocalFirstDashboard(departmentId?: string) {
    const { user } = useAuth();

    return useQuery(['dashboard-sync', departmentId], async () => {
        try {
            // Attempt to get fresh data from the cloud
            const res = await api.get('/dashboard/sync', { params: { departmentId } });
            const data = res.data;

            // Opportunistically hydrate the local tactical cache with the fresh data
            // This ensures future offline sessions are seeded with the latest state.
            if (data) {
                await Promise.all([
                    data.settings && db.settings.put({ id: 'GLOBAL', ...data.ministrySettings }),
                    data.affirmation && db.affirmations.put({ id: 'DAILY', ...data.affirmation }),
                    data.account && db.account.put(data.account)
                ]);
            }

            return { ...data, source: 'NETWORK' };
        } catch (error) {
            console.warn('[Palace-Sync] Network unreachable. Switching to Tactical Local Cache.');
            
            // ─── AGGREGATE TACTICAL LOCAL CACHE ───
            const [
                projects, events, plans, meetings, children, 
                announcements, baptisms, departments, transactions,
                repairs, appointments, ministrySettings, affirmation, account
            ] = await Promise.all([
                db.projects.toArray(),
                db.events.toArray(),
                db.plans.toArray(),
                db.meetings.toArray(),
                db.children.toArray(),
                db.announcements.toArray(),
                db.baptisms.toArray(),
                db.departments.toArray(),
                db.transactions.toArray(),
                db.repairs.toArray(),
                db.appointments.toArray(),
                db.settings.get('GLOBAL'),
                db.affirmations.get('DAILY'),
                db.account.get('MAIN') // Adjust if multiple accounts exist
            ]);

            return {
                projects,
                events,
                plans,
                meetings,
                children,
                announcements,
                baptisms,
                departments,
                transactions,
                repairs,
                appointments,
                ministrySettings: ministrySettings || { themeOfYear: 'OFFLINE MODE', themeOfMonth: 'LOCAL DATA ONLY' },
                affirmation: affirmation || { content: 'Faith works even without a connection.' },
                account: account || { balance: 0 },
                source: 'LOCAL_CACHE',
                isOffline: true
            };
        }
    }, {
        enabled: !!user,
        refetchInterval: navigator.onLine ? 10000 : false, // Poll only if online
        staleTime: 5000,
    });
}
