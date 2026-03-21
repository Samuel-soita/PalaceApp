import prisma from './prisma.js';

export class InsightsService {
    /**
     * Aggregates key metrics for the Decision Intelligence dashboard.
     */
    static async getGovernanceMetrics() {
        const [
            totalMembers,
            activePartners,
            totalLedgerAmount,
            pendingApprovals,
            attendanceTrend
        ] = await Promise.all([
            prisma.user.count({ where: { role: 'MEMBER', deletedAt: null } as any }),
            prisma.user.count({ where: { isPartner: true, deletedAt: null } as any }),
            (prisma as any).partnershipLedger.aggregate({
                _sum: { amount: true }
            }),
            prisma.baptism.count({ where: { status: 'PENDING' } }),
            // Simplified trend: Meetings in the last 30 days
            prisma.meeting.count({
                where: {
                    createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                    deletedAt: null
                } as any
            })
        ]);

        // 7-Day Activity Trend
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const activityLogs = await prisma.auditLog.findMany({
            where: { createdAt: { gte: sevenDaysAgo } },
            select: { createdAt: true }
        });

        // Group by day
        const activityTrend = Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const count = activityLogs.filter(log => log.createdAt.toISOString().split('T')[0] === dateStr).length;
            return { date: dateStr, count };
        }).reverse();

        return {
            demographics: { totalMembers, activePartners },
            finance: { totalInflow: totalLedgerAmount._sum.amount || 0 },
            operations: { pendingApprovals, recentMeetings: attendanceTrend },
            trends: activityTrend,
            health: 'OPTIMAL'
        };
    }

    /**
     * Generates a CSV string for Partnership Ledger data.
     */
    static async exportLedgerCSV() {
        const ledgers = await (prisma as any).partnershipLedger.findMany({
            include: { partnership: { include: { user: { select: { name: true } } } } },
            orderBy: { createdAt: 'desc' },
            take: 1000
        });

        const header = 'Date,Member,Amount,Method,Reference\n';
        const rows = ledgers.map((l: any) => {
            const date = l.createdAt.toISOString().split('T')[0];
            const member = l.partnership.user.name.replace(/,/g, '');
            return `${date},${member},${l.amount},${l.paymentMethod},${l.referenceCode}`;
        }).join('\n');

        return header + rows;
    }
}
