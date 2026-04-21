import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
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

    // 1. TACTICAL LOCAL MIRROR (Priority 1: Instant Load)
    const localData = useLiveQuery(async () => {
        const [
            projects, events, plans, meetings, children, 
            announcements, baptisms, departments, transactions,
            repairs, appointments, settings, affirmation, account, auditLogs, members, devotions
        ] = await Promise.all([
            db.projects.limit(50).reverse().toArray(),
            db.events.limit(50).toArray(),
            db.plans.limit(50).toArray(),
            db.meetings.limit(50).toArray(),
            db.children.limit(50).toArray(),
            db.announcements.limit(50).toArray(),
            db.baptisms.toArray(),
            db.departments.toArray(),
            db.transactions.limit(75).reverse().toArray(),
            db.repairs.toArray(),
            db.appointments.toArray(),
            db.settings.get('GLOBAL'),
            db.affirmations.get('DAILY'),
            db.account.get('MAIN'),
            db.auditLogs.limit(20).toArray(),
            db.users.filter(u => !departmentId || u.departmentId === departmentId).toArray(),
            db.devotions.get('DAILY')
        ]);

        return {
            projects, events, plans, meetings, children, 
            announcements, baptisms, departments, transactions,
            repairs, appointments, auditLogs, departmentMembers: members,
            devotion: devotions,
            ministrySettings: settings || { themeOfYear: 'OFFLINE MODE', themeOfMonth: 'LOCAL DATA ONLY' },
            affirmation: affirmation || { content: 'Faith works even without a connection.' },
            account: account || { balance: 0 },
            globalMetrics: {
                totalUsers: members.length,
                pendingApprovals: transactions.filter(t => t.syncStatus === 'PENDING').length,
                totalPartners: 0,
                pendingDedications: 0
            }
        };
    }, [departmentId]);

    // 2. STRATEGIC GLOBAL RECONCILIATION
    return useQuery(['dashboard-sync', departmentId], async () => {
        try {
            const res = await api.get('/dashboard/sync', { params: { departmentId } });
            const data = res.data;

            if (data) {
                // Background hydration: Sync incoming data into Dexie
                await Promise.all([
                    data.ministrySettings && db.settings.put({ id: 'GLOBAL', ...data.ministrySettings }),
                    data.affirmation && db.affirmations.put({ id: 'DAILY', ...data.affirmation }),
                    data.devotion && db.devotions.put({ id: 'DAILY', ...data.devotion }),
                    data.account && db.account.put({ ...data.account, id: 'MAIN' }),
                    data.projects && db.projects.bulkPut(data.projects),
                    data.events && db.events.bulkPut(data.events),
                    data.transactions && db.transactions.bulkPut(data.transactions),
                    data.departmentMembers && db.users.bulkPut(data.departmentMembers)
                    // ... other modules are handled by pwa-sync.ts daemon
                ]);
            }

            return { ...data, source: 'NETWORK' };
        } catch (error) {
            console.warn('[Palace-Sync] Local Recon in progress...');
            throw error; // Let react-query handle retry/error state
        }
    }, {
        enabled: !!user,
        refetchInterval: navigator.onLine ? 30000 : false,
        staleTime: 10000,
        placeholderData: localData, // Use local mirrored data while loading
        retry: 2
    });
}
