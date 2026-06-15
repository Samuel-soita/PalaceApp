import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import api from '../lib/api-client';
import { db } from '../lib/db';
import { useAuth } from '../contexts/AuthContext';
import { isOnlineSessionActive } from '../lib/auth-session';

/**
 * Local-first dashboard engine — instant Dexie load, background API hydration.
 */
export function useLocalFirstDashboard(departmentId?: string) {
    const { user } = useAuth();

    const localData = useLiveQuery(async () => {
        const [
            projects, events, plans, meetings, children, 
            announcements, baptisms, departments, transactions,
            repairs, appointments, settings, affirmation, account, auditLogs, members, devotions, partnerships
        ] = await Promise.all([
            db.projects.limit(50).reverse().toArray(),
            db.events.limit(50).toArray(),
            db.plans.limit(50).toArray(),
            db.meetings.limit(30).toArray(),
            db.children.limit(50).toArray(),
            db.announcements.limit(50).toArray(),
            db.baptisms.limit(50).toArray(),
            db.departments.toArray(),
            db.transactions.limit(75).reverse().toArray(),
            db.repairs.limit(30).toArray(),
            db.appointments.limit(50).toArray(),
            db.settings.get('GLOBAL'),
            db.affirmations.get('DAILY'),
            db.account.get('MAIN'),
            db.auditLogs.limit(20).toArray(),
            db.users.filter(u => !departmentId || u.departmentId === departmentId).limit(200).toArray(),
            db.devotions.get('DAILY'),
            db.partnerships.limit(100).toArray(),
        ]);

        const pendingWithdrawals = transactions.filter((t) => t.status !== 'APPROVED' && t.type === 'WITHDRAWAL').length;

        const myPartnership = user?.id
            ? partnerships
                .filter((p: any) => p.userId === user.id)
                .sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())[0]
            : undefined;

        return {
            projects, events, plans, meetings, children, 
            announcements, baptisms, departments, transactions,
            repairs, appointments, auditLogs, departmentMembers: members,
            allPartnerships: partnerships,
            partnership: myPartnership,
            isPartner: user?.isPartner || !!myPartnership,
            devotion: devotions,
            ministrySettings: settings || { themeOfYear: 'OFFLINE MODE', themeOfMonth: 'LOCAL DATA ONLY' },
            affirmation: affirmation || { content: 'Faith works even without a connection.' },
            account: account || { balance: 0 },
            globalMetrics: {
                totalUsers: members.length,
                pendingApprovals: pendingWithdrawals,
                totalPartners: partnerships.length,
                pendingDedications: children.filter((c: any) => c.workflowStatus !== 'DEDICATED').length,
            },
            isOffline: !navigator.onLine,
        };
    }, [departmentId, user?.id, user?.isPartner]);

    const query = useQuery(['dashboard-sync', departmentId], async () => {
        const res = await api.get('/dashboard/sync', { params: { departmentId } });
        const data = res.data;

        if (data) {
            const partnershipRows = [
                ...(data.allPartnerships || []),
                ...(data.partnership ? [data.partnership] : []),
            ];
            const dedupedPartnerships = Array.from(
                new Map(partnershipRows.filter((p: any) => p?.id).map((p: any) => [p.id, { ...p, syncStatus: 'SYNCED' as const }])).values()
            );

            await Promise.all([
                data.ministrySettings && db.settings.put({ id: 'GLOBAL', ...data.ministrySettings }),
                data.affirmation && db.affirmations.put({ id: 'DAILY', ...data.affirmation }),
                data.devotion && db.devotions.put({ id: 'DAILY', ...data.devotion }),
                data.account && db.account.put({ ...data.account, id: 'MAIN' }),
                data.projects && db.projects.bulkPut(data.projects),
                data.events && db.events.bulkPut(data.events),
                data.transactions && db.transactions.bulkPut(data.transactions),
                data.departmentMembers && db.users.bulkPut(data.departmentMembers),
                dedupedPartnerships.length > 0 && db.partnerships.bulkPut(dedupedPartnerships),
            ]);
        }

        return {
            ...data,
            source: 'NETWORK',
            isOffline: false,
            globalMetrics: {
                totalUsers: data?.departmentMembers?.length ?? data?.globalMetrics?.totalUsers ?? 0,
                pendingApprovals: data?.transactions?.filter((tx: any) => tx.status !== 'APPROVED' && tx.type === 'WITHDRAWAL').length ?? 0,
                totalPartners: data?.globalMetrics?.totalPartners ?? 0,
                pendingDedications: data?.globalMetrics?.pendingDedications ?? 0,
            },
        };
    }, {
        enabled: !!user && isOnlineSessionActive(),
        refetchInterval: navigator.onLine ? 60000 : false,
        staleTime: 30000,
        placeholderData: localData,
        retry: 1,
    });

    const mergedData = query.data ?? localData;
    const isOffline = !navigator.onLine || query.isError;

    const data = mergedData ? {
        ...mergedData,
        ...(localData && {
            partnership: localData.partnership ?? mergedData.partnership,
            allPartnerships: (localData.allPartnerships?.length ?? 0) > 0
                ? localData.allPartnerships
                : mergedData.allPartnerships,
            isPartner: localData.isPartner ?? mergedData.isPartner,
        }),
        isOffline,
    } : mergedData;

    return {
        ...query,
        data,
    };
}
