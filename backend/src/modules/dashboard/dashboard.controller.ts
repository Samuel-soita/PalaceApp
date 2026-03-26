import { Response } from 'express';
import prisma from '../../utils/prisma.js';
import { getOrSetCache } from '../../utils/redis.js';

export const getDashboardSync = async (req: any, res: Response) => {
    try {
        const { id: userId, role, departmentId: userDeptId } = req.user;
        const { departmentId } = req.query;

        // Effective department ID for filtering
        const isAdmin = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'WATUA', 'PASTOR'].includes(role);
        const effectiveDeptId = (isAdmin && departmentId) ? departmentId : (isAdmin ? null : userDeptId);

        const isLeader = ['PASTOR', 'DEPARTMENT_LEADER'].includes(role);

        // Cache key includes role and department for security/relevance
        const cacheKey = `dashboard:sync:${userId}:${effectiveDeptId || 'global'}`;

        const data = await getOrSetCache(cacheKey, async () => {
            // 1. Fetch user record first to use for filtering in subsequent queries
            const userRecord = await (prisma as any).user.findUnique({ 
                where: { id: userId }, 
                select: { dob: true, gender: true, departmentId: true, isPartner: true } 
            });

            // Helper to build relevant 'where' clause for members
            const getWhere = (majField: string = 'isMajor') => {
                if (isAdmin) {
                    return effectiveDeptId ? { departmentId: effectiveDeptId } : {};
                }
                
                // If member/leader has no department, only show major/global items
                if (!userDeptId) {
                    return { [majField]: true };
                }

                // Members see their department OR major global items
                return { OR: [{ departmentId: userDeptId }, { [majField]: true }] };
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
                partnership
            ] = await Promise.all([
                prisma.project.findMany({ 
                    where: getWhere(), 
                    take: 50, 
                    orderBy: { createdAt: 'desc' },
                    select: { id: true, title: true, status: true, progress: true, deadline: true, departmentId: true, isMajor: true }
                }),
                prisma.event.findMany({ 
                    where: getWhere(), 
                    take: 50, 
                    orderBy: { date: 'asc' },
                    select: { id: true, title: true, date: true, time: true, status: true, departmentId: true, isMajor: true }
                }),
                prisma.plan.findMany({ 
                    where: getWhere(), 
                    take: 50, 
                    orderBy: { createdAt: 'desc' },
                    select: { id: true, title: true, approvalStatus: true, type: true, departmentId: true, isMajor: true }
                }),
                prisma.meeting.findMany({ 
                    where: isAdmin 
                        ? (effectiveDeptId ? { departmentId: effectiveDeptId } : {}) 
                        : { 
                            OR: [
                                { departmentId: userDeptId },
                                { isPartnerOnly: userRecord?.isPartner || false }
                            ]
                        }, 
                    take: 50, 
                    orderBy: { date: 'asc' },
                    select: { id: true, title: true, date: true, time: true, venue: true, meetingStatus: true, departmentId: true, isPartnerOnly: true } as any
                }),
                prisma.announcement.findMany({ 
                    where: getWhere('isGlobal'), 
                    take: 50, 
                    orderBy: { createdAt: 'desc' },
                    select: { id: true, title: true, priority: true, status: true, createdAt: true, isGlobal: true, content: true }
                }),
                prisma.department.findMany({ select: { id: true, name: true } }),
                isAdmin ? prisma.user.findMany({ 
                    where: { OR: [{ status: 'PENDING' }, { isCardReplacementRequested: true }, { deletionRequested: true }] },
                    take: 100,
                    orderBy: { createdAt: 'desc' },
                    select: { id: true, name: true, membershipNumber: true, role: true, departmentId: true, deletionRequested: true, isPartner: true, isCardPaid: true, status: true, isCardReplacementRequested: true, membershipExpiry: true }
                }) : Promise.resolve([]),
                (isAdmin || isLeader) 
                    ? prisma.baptism.findMany({ 
                        select: { id: true, status: true, createdAt: true, user: { select: { name: true } } } 
                    })
                    : prisma.baptism.findMany({ 
                        where: { userId },
                        select: { id: true, status: true, createdAt: true }
                    }),
                (isAdmin || isLeader)
                    ? prisma.child.findMany({ 
                        take: 50,
                        select: { id: true, name: true, dob: true, dedicationNumber: true, workflowStatus: true, departmentId: true, department: { select: { name: true } } }
                    })
                    : prisma.child.findMany({ 
                        where: { parentId: userId },
                        select: { id: true, name: true, dob: true, dedicationNumber: true, workflowStatus: true, department: { select: { name: true } } }
                    }),
                (prisma as any).ministrySettings.findUnique({ where: { id: 'GLOBAL' }, select: { id: true, themeOfYear: true, themeOfMonth: true, churchBudget: true } }),
                (prisma as any).affirmation.findFirst({ where: { date: new Date(new Date().setHours(0,0,0,0)) } }),
                prisma.partnership.findFirst({ where: { userId, status: 'ACTIVE' } })
            ]);

            // --- AUTO DEPARTMENT MAPPING ---
            if (userRecord && userRecord.dob && userRecord.gender) {
                const age = new Date().getFullYear() - new Date(userRecord.dob).getFullYear();
                let targetDeptName = '';
                
                if (age > 57) targetDeptName = 'Elders';
                else if (age < 31) targetDeptName = 'Youth';
                else if (userRecord.gender === 'FEMALE') targetDeptName = 'Women';
                else if (userRecord.gender === 'MALE') targetDeptName = 'Men';

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

            // --- AUTO AFFIRMATION GENERATION ---
            let dailyAffirmation = foundAffirmation;
            if (!dailyAffirmation) {
                const affirmationsPool = [
                    "I am a child of God, called and chosen for greatness.",
                    "The favor of God surrounds me as a shield today.",
                    "I have the mind of Christ and divine wisdom for every decision.",
                    "God's grace is sufficient for me, and His strength is perfect in my weakness.",
                    "No weapon formed against me shall prosper.",
                    "I am more than a conqueror through Him who loved me.",
                    "My presence in the sanctuary is not a coincidence, it is an assignment.",
                    "I am blessed to be a blessing to others today.",
                    "The Lord is my shepherd; I shall not want.",
                    "I walk in divine health and supernatural protection."
                ];
                const randomAffirmation = affirmationsPool[Math.floor(Math.random() * affirmationsPool.length)];
                
                // Use upsert to handle race conditions gracefully
                const todayDate = new Date(new Date().setHours(0,0,0,0));
                dailyAffirmation = await (prisma as any).affirmation.upsert({
                    where: { date: todayDate },
                    update: {},
                    create: {
                        content: randomAffirmation,
                        date: todayDate
                    }
                });
            }

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
                partnership: (partnership as any)
            };
        }, 10); // High-frequency cache for real-time situational awareness

        res.json(data);
    } catch (error) {
        console.error('Dashboard Sync Error:', error);
        res.status(500).json({ error: 'Failed to sync dashboard data.' });
    }
};
