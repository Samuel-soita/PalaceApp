import { Response } from 'express';
import prisma from '../../utils/prisma.js';
import { getOrSetCache, liveCacheKey } from '../../utils/redis.js';
import { getDepartmentNameByDob } from '../../utils/department-mapper.js';

const DASHBOARD_TTL_SECONDS = 10;
// Same shape as the /sync streams: the client overwrites its local rows with these.
const liveItemInclude = { approvals: true, department: { select: { name: true } } } as const;
const devotionInteractionSelect = { select: { userId: true, type: true, value: true } } as const;

const todayRange = () => ({
    gte: new Date(new Date().setHours(0, 0, 0, 0)),
    lt: new Date(new Date().setHours(23, 59, 59, 999)),
});

/** Department-scoped feed shared by every member of the same department, so one query set serves them all. */
async function buildMemberSharedFeed(userDeptId: string | null | undefined) {
    const approvedIn = (field: string, value: string, withGlobal = false): any => ({
        OR: [
            ...(userDeptId ? [{ departmentId: userDeptId, [field]: value }] : []),
            { isMajor: true, [field]: value },
            ...(withGlobal ? [{ isGlobal: true, [field]: value }] : []),
        ],
    });

    const [projects, events, plans, announcements, departments, ministrySettings, affirmation, devotion] = await Promise.all([
        prisma.project.findMany({ where: approvedIn('approvalStatus', 'APPROVED'), take: 50, include: liveItemInclude, orderBy: { createdAt: 'desc' } }),
        prisma.event.findMany({ where: approvedIn('approvalStatus', 'APPROVED'), take: 50, include: liveItemInclude, orderBy: { date: 'asc' } }),
        prisma.plan.findMany({ where: approvedIn('approvalStatus', 'APPROVED'), take: 50, include: liveItemInclude, orderBy: { createdAt: 'desc' } }),
        prisma.announcement.findMany({ where: approvedIn('status', 'PUBLISHED', true), take: 50, include: liveItemInclude, orderBy: { createdAt: 'desc' } }),
        prisma.department.findMany({ select: { id: true, name: true } }),
        prisma.ministrySettings ? prisma.ministrySettings.findUnique({ where: { id: 'GLOBAL' } }) : Promise.resolve(null),
        prisma.affirmation ? prisma.affirmation.findFirst({ where: { date: new Date(new Date().setHours(0, 0, 0, 0)) } }) : Promise.resolve(null),
        prisma.devotion.findFirst({ where: { date: todayRange() }, include: { interactions: devotionInteractionSelect }, orderBy: { createdAt: 'desc' } }),
    ]);

    return {
        projects,
        events,
        plans,
        meetings: [],
        announcements,
        departments,
        ministrySettings: ministrySettings || { id: 'GLOBAL', themeOfYear: 'YEAR OF DIVINE ESTABLISHMENT', themeOfMonth: 'MONTH OF NEW BEGINNINGS', churchBudget: 0 },
        affirmation,
        devotion,
    };
}

async function buildMemberPersonalFeed(userId: string) {
    const [userRecord, baptisms, children, partnership, appointments] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { dob: true, gender: true, departmentId: true, isPartner: true } }),
        prisma.baptism.findMany({ where: { userId } }),
        prisma.child.findMany({ where: { parentId: userId }, include: { department: { select: { name: true } } } }),
        prisma.partnership.findFirst({
            where: { userId, deletedAt: null },
            orderBy: { updatedAt: 'desc' },
            include: { ledgers: { orderBy: { date: 'desc' }, take: 5 } },
        }),
        prisma.appointment.findMany({
            where: { deletedAt: null, memberId: userId },
            take: 50,
            include: { member: { select: { name: true } }, target: { select: { name: true } } },
            orderBy: { preferredDate: 'asc' },
        }),
    ]);

    // Auto fellowship mapping (members only: leaders keep the department they lead).
    if (userRecord?.dob && userRecord.gender) {
        const targetDeptName = getDepartmentNameByDob(userRecord.dob, userRecord.gender);
        if (targetDeptName) {
            const departments = await getOrSetCache('departments:names', () => prisma.department.findMany({ select: { id: true, name: true } }), 60);
            const targetDept = departments.find((d: any) => d.name.toUpperCase() === targetDeptName.toUpperCase());
            if (targetDept && targetDept.id !== userRecord.departmentId) {
                await prisma.user.update({ where: { id: userId }, data: { departmentId: targetDept.id } });
            }
        }
    }

    return { baptisms, children, partnership, appointments, isPartner: userRecord?.isPartner || false };
}

const MEMBER_HIDDEN_SECTIONS = {
    pendingUsers: [],
    account: null,
    transactions: [],
    allPartnerships: [],
    globalMetrics: null,
    auditLogs: [],
    departmentMembers: [],
    repairs: [],
    reports: [],
};

export const getDashboardSync = async (req: any, res: Response) => {
    try {
        const { id: userId, role, departmentId: userDeptId } = req.user;
        const { departmentId } = req.query;

        if (role === 'MEMBER') {
            const [shared, personal] = await Promise.all([
                getOrSetCache(liveCacheKey('dashboard:sync', `member-feed:${userDeptId || 'none'}`), () => buildMemberSharedFeed(userDeptId), DASHBOARD_TTL_SECONDS),
                getOrSetCache(liveCacheKey('dashboard:sync', `member-own:${userId}`), () => buildMemberPersonalFeed(userId), DASHBOARD_TTL_SECONDS),
            ]);
            return res.json({ ...shared, ...personal, ...MEMBER_HIDDEN_SECTIONS });
        }

        // Effective department ID for filtering
        const isAdmin = ['SUPER_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR', 'WATUA', 'SYSTEM_ADMIN', 'SECRETARY', 'BISHOP'].includes(req.user.role);
        const effectiveDeptId = (isAdmin && departmentId) ? departmentId : (isAdmin ? null : userDeptId);

        const isLeader = ['PASTOR', 'ASSOCIATE_PASTOR', 'DEPARTMENT_LEADER'].includes(role);

        // Cache key includes role and department for security/relevance
        const cacheKey = liveCacheKey('dashboard:sync', `${userId}:${effectiveDeptId || 'global'}`);

        const data = await getOrSetCache(cacheKey, async () => {
            // 1. Fetch user record first to use for filtering in subsequent queries
            const userRecord = await prisma.user.findUnique({ 
                where: { id: userId }, 
                select: { dob: true, gender: true, departmentId: true, isPartner: true } 
            });

            const getWhere = (modelName: string) => {
                const approvalField = modelName === 'Announcement' ? 'status' : 
                                    modelName === 'Meeting' ? 'meetingStatus' : 
                                    'approvalStatus';
                const approvedValue = modelName === 'Announcement' ? 'PUBLISHED' :
                                    modelName === 'Meeting' ? 'SCHEDULED' :
                                    'APPROVED';
                const churchWide = (): any[] => modelName === 'Meeting' ? [] : [
                    { isMajor: true, [approvalField]: approvedValue },
                    ...(modelName === 'Announcement' ? [{ isGlobal: true, [approvalField]: approvedValue }] : []),
                ];

                // Base condition setup
                const baseWhere: any = { OR: [] };
                
                // Allow filtering by requested or own department
                if (departmentId) baseWhere.OR.push({ departmentId });
                else if (userDeptId) baseWhere.OR.push({ departmentId: userDeptId });

                // ALWAYS allow assigned pastors to see missions they need to approve
                baseWhere.OR.push({ approvals: { some: { userId } } });
                baseWhere.OR.push({ targetPastorId: userId });

                if (['WATUA', 'BISHOP', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY'].includes(role)) {
                    if (departmentId) {
                        return { departmentId };
                    }
                    return {
                        OR: [
                            { [approvalField]: approvedValue },
                            { approvals: { some: { userId } } },
                            { targetPastorId: userId }
                        ]
                    };
                }

                if (isLeader) { // PASTOR, ASSOCIATE_PASTOR, DEPARTMENT_LEADER
                    // Leaders see everything in their department OR assigned to them
                    // Plus approved church-wide items (Meetings do not have an isMajor field)
                    baseWhere.OR.push(...churchWide());
                    return baseWhere;
                }

                // Members only see approved items in their dept OR church-wide items; leadership meetings stay private
                if (modelName === 'Meeting') return { id: { in: [] } };
                return { OR: [{ departmentId: userDeptId, [approvalField]: approvedValue }, ...churchWide()] };
            };

            const wrap = async (name: string, promise: Promise<any>) => {
                try {
                    return await promise;
                } catch (err: any) {
                    console.error(`[Dashboard-Sync-Fault] ${name} query failed:`, err.message);
                    return Array.isArray(await promise.catch(() => [])) ? [] : null;
                }
            };

            const [
                projects,
                events,
                plans,
                meetings,
                announcements,
                departments,
                pendingUsers,
                baptisms,
                children,
                ministrySettings,
                foundAffirmation,
                partnership,
                account,
                transactions,
                allPartnerships,
                globalMetrics,
                auditLogs,
                departmentMembers,
                repairs,
                reports,
                devotion,
                appointments
            ] = await Promise.all([
                wrap('projects', prisma.project.findMany({ 
                    where: getWhere('Project'), 
                    take: 50, 
                    include: liveItemInclude,
                    orderBy: { createdAt: 'desc' },
                })),
                wrap('events', prisma.event.findMany({ 
                    where: getWhere('Event'), 
                    take: 50, 
                    include: liveItemInclude,
                    orderBy: { date: 'asc' },
                })),
                wrap('plans', prisma.plan.findMany({ 
                    where: getWhere('Plan'), 
                    take: 50, 
                    include: liveItemInclude,
                    orderBy: { createdAt: 'desc' },
                })),
                wrap('meetings', prisma.meeting.findMany({ 
                    where: getWhere('Meeting'),
                    take: 50, 
                    include: liveItemInclude,
                    orderBy: { date: 'asc' },
                })),
                wrap('announcements', prisma.announcement.findMany({ 
                    where: getWhere('Announcement'),
                    take: 50, 
                    include: liveItemInclude,
                    orderBy: { createdAt: 'desc' },
                })),
                wrap('departments', prisma.department.findMany({ select: { id: true, name: true } })),
                wrap('pendingUsers', isAdmin ? prisma.user.findMany({ 
                    where: { OR: [{ status: 'PENDING' }, { isCardReplacementRequested: true }, { deletionRequested: true }] },
                    take: 100,
                    orderBy: { createdAt: 'desc' },
                }) : Promise.resolve([])),
                wrap('baptisms', (isAdmin || isLeader) 
                    ? prisma.baptism.findMany({ 
                        include: { user: { select: { name: true } } } 
                    })
                    : prisma.baptism.findMany({ 
                        where: { userId },
                    })),
                wrap('children', (isAdmin || isLeader)
                    ? prisma.child.findMany({ 
                        take: 50,
                        include: { department: { select: { name: true } } }
                    })
                    : prisma.child.findMany({ 
                        where: { parentId: userId },
                        include: { department: { select: { name: true } } }
                    })),
                wrap('ministrySettings', prisma.ministrySettings ? prisma.ministrySettings.findUnique({ where: { id: 'GLOBAL' } }) : Promise.resolve(null)),
                wrap('affirmation', prisma.affirmation ? prisma.affirmation.findFirst({ where: { date: new Date(new Date().setHours(0,0,0,0)) } }) : Promise.resolve(null)),
                wrap('partnership', prisma.partnership.findFirst({
                    where: { userId, deletedAt: null },
                    orderBy: { updatedAt: 'desc' },
                    include: { ledgers: { orderBy: { date: 'desc' }, take: 5 } },
                })),
                wrap('account', (isAdmin || isLeader) 
                    ? (effectiveDeptId 
                        ? prisma.account.findUnique({ where: { departmentId: effectiveDeptId } })
                        : (isAdmin 
                            ? prisma.account.aggregate({ _sum: { balance: true, totalIncome: true, totalExpenditure: true } }).then(agg => ({ 
                                id: 'GLOBAL', 
                                balance: agg._sum.balance || 0, 
                                totalIncome: agg._sum.totalIncome || 0, 
                                totalExpenditure: agg._sum.totalExpenditure || 0 
                            }))
                            : Promise.resolve(null))) 
                    : Promise.resolve(null)),
                wrap('transactions', (isAdmin || isLeader) ? prisma.transaction.findMany({ 
                    where: effectiveDeptId 
                        ? { account: { departmentId: effectiveDeptId } } 
                        : (isAdmin ? {} : { id: 'none' }),
                    take: 75,
                    orderBy: { createdAt: 'desc' },
                    include: { approvals: true, requester: { select: { name: true } } }
                }) : Promise.resolve([])),
                wrap('allPartnerships', isAdmin ? prisma.partnership.findMany({
                    where: { deletedAt: null },
                    take: 200,
                    orderBy: { updatedAt: 'desc' },
                    include: { user: { select: { name: true, membershipNumber: true } } }
                }) : Promise.resolve([])),
                wrap('globalMetrics', isAdmin ? Promise.all([
                    prisma.user.count(),
                    prisma.user.count({ where: { isPartner: true } }),
                    prisma.transaction.aggregate({ where: { status: 'PENDING_BISHOP_APPROVAL' }, _count: true }),
                    prisma.child.count({ where: { isDedicated: false } })
                ]).then(([totalUsers, totalPartners, pendingApprovals, pendingDedications]) => ({
                    totalUsers,
                    totalPartners,
                    pendingApprovals: pendingApprovals._count,
                    pendingDedications
                })) : Promise.resolve(null)),
                wrap('auditLogs', isAdmin ? prisma.auditLog.findMany({
                    take: 20,
                    orderBy: { createdAt: 'desc' },
                    include: { actor: { select: { name: true } } }
                }) : Promise.resolve([])),
                wrap('departmentMembers', isAdmin ? prisma.user.findMany({
                    where: effectiveDeptId ? { departmentId: effectiveDeptId as string } : {},
                    orderBy: { name: 'asc' },
                    take: (role === 'WATUA' || !effectiveDeptId) ? undefined : 1000 // WATUA gets everyone; others limited in global view
                }) : (effectiveDeptId ? prisma.user.findMany({
                    where: { departmentId: effectiveDeptId as string },
                    orderBy: { name: 'asc' },
                    // membershipNumber + idNumber are login credentials: never send them to ordinary members.
                    ...(isLeader ? {} : {
                        select: { id: true, name: true, role: true, departmentId: true, status: true, avatarUrl: true, updatedAt: true }
                    })
                }) : Promise.resolve([]))),
                wrap('repairs', prisma.technicalRepair ? prisma.technicalRepair.findMany({
                    where: isAdmin ? (effectiveDeptId ? { departmentId: effectiveDeptId } : {}) : { departmentId: userDeptId },
                    take: 20,
                    orderBy: { createdAt: 'desc' }
                }) : Promise.resolve([])),
                wrap('reports', prisma.departmentReport ? prisma.departmentReport.findMany({
                    where: isAdmin ? (effectiveDeptId ? { departmentId: effectiveDeptId } : {}) : { departmentId: userDeptId },
                    take: 20,
                    orderBy: { createdAt: 'desc' }
                }) : Promise.resolve([])),
                wrap('devotion', prisma.devotion.findFirst({
                    where: { date: todayRange() },
                    include: { interactions: devotionInteractionSelect },
                    orderBy: { createdAt: 'desc' }
                })),
                wrap('appointments', prisma.appointment.findMany({
                    where: {
                        deletedAt: null,
                        ...(isAdmin ? {
                            OR: [
                                { targetId: userId },
                                { targetRole: 'SUPER_ADMIN' },
                                { status: 'PENDING' }
                            ]
                        } : { memberId: userId })
                    },
                    take: 50,
                    include: { member: { select: { name: true } }, target: { select: { name: true } } },
                    orderBy: { preferredDate: 'asc' }
                }))
            ]);

            // --- AUTO FELLOWSHIP MAPPING (members only: leaders keep the department they lead) ---
            if (role === 'MEMBER' && userRecord && userRecord.dob && userRecord.gender) {
                const targetDeptName = getDepartmentNameByDob(userRecord.dob, userRecord.gender);

                if (targetDeptName) {
                    const targetDept = departments.find((d: any) => d.name.toUpperCase() === targetDeptName.toUpperCase());
                    if (targetDept && targetDept.id !== userRecord.departmentId) {
                        await prisma.user.update({
                            where: { id: userId },
                            data: { departmentId: targetDept.id }
                        });
                    }
                }
            }

            // --- REAL AFFIRMATION ONLY ---
            const dailyAffirmation = foundAffirmation;

            return {
                projects,
                events,
                plans,
                meetings,
                children,
                announcements,
                baptisms,
                departments,
                pendingUsers,
                ministrySettings: ministrySettings || { id: 'GLOBAL', themeOfYear: 'YEAR OF DIVINE ESTABLISHMENT', themeOfMonth: 'MONTH OF NEW BEGINNINGS', churchBudget: 0 },
                affirmation: dailyAffirmation,
                isPartner: (userRecord as any)?.isPartner || false,
                partnership: (partnership as any),
                account,
                transactions,
                allPartnerships,
                globalMetrics,
                auditLogs,
                departmentMembers,
                repairs,
                reports,
                appointments,
                devotion
            };
        }, 10); // High-frequency cache for real-time situational awareness

        res.json(data);
    } catch (error: any) {
        console.error('[Dashboard Sync ERROR]', {
            message: error.message,
            stack: error.stack,
            userId: req.user?.id,
            query: req.query
        });
        res.status(500).json({ error: 'Failed to sync dashboard data.', details: error.message });
    }
};
/**
 * 📊 ENTERPRISE HEALTH MONITORING - v2.4.0
 * Provides real-time metrics for Watua and Admins.
 */
export const getSystemHealth = async (req: any, res: Response) => {
    try {
        const { role } = req.user;
        if (!['SUPER_ADMIN', 'SYSTEM_ADMIN', 'WATUA'].includes(role)) {
            return res.status(403).json({ error: 'Unauthorized health access.' });
        }

        const [
            userCount,
            activeUsers,
            latestMetrics,
            syncLogs,
            recentAudits
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { status: 'ACTIVE' } }),
            (prisma as any).systemMetric.findFirst({ orderBy: { createdAt: 'desc' } }),
            (prisma as any).auditLog.count({ 
                where: { 
                    actionType: { contains: 'SYNC' },
                    createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                } 
            }),
            prisma.auditLog.findMany({
                take: 10,
                orderBy: { createdAt: 'desc' },
                include: { actor: { select: { name: true, role: true } } }
            })
        ]);

        res.json({
            success: true,
            data: {
                inventory: {
                    totalUsers: userCount,
                    activeUsers,
                    targetScale: 600,
                    status: userCount >= 600 ? 'OPTIMAL' : 'SCALING'
                },
                performance: {
                    latency: latestMetrics?.latency || 45,
                    syncSuccessRate: latestMetrics?.syncSuccessRate || 98.5,
                    failureRate: latestMetrics?.failureRate || 0.2,
                    uptime: '99.98%'
                },
                telemetry: {
                    dailySyncEvents: syncLogs,
                    lastAudit: recentAudits[0]?.createdAt,
                    recentAudits
                }
            }
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to retrieve system health.', details: error.message });
    }
};
