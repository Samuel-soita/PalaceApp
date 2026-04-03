import { Response } from 'express';
import prisma from '../../utils/prisma.js';

/**
 * Modular Delta Sync Engine: The Pulse of 2.4.0.
 * Instead of a monolithic blob, we stream granular, timestamp-aware
 * modules to ensure minimum latency and maximum PWA offline reliability.
 */
export const getDeltaSync = async (req: any, res: Response) => {
    try {
        const { module } = req.params;
        const { since, departmentId } = req.query;
        const { id: userId, role, departmentId: userDeptId } = req.user;

        const timestamp = since ? new Date(since as string) : new Date(0);
        const isAdmin = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'WATUA', 'PASTOR'].includes(role);
        const effectiveDeptId = (isAdmin && departmentId) ? departmentId : (isAdmin ? null : userDeptId);

        // Helper for standard scoping
        const getStandardWhere = (options: { majField?: string | null, supportsDept?: boolean } = {}) => {
            const { majField = 'isMajor', supportsDept = true } = options;
            
            const base: any = { 
                OR: [
                    { updatedAt: { gt: timestamp } },
                    { deletedAt: { gt: timestamp } }
                ]
            };
            
            if (isAdmin) {
                if (supportsDept && effectiveDeptId) base.departmentId = effectiveDeptId;
                return base;
            }
            
            if (supportsDept && !userDeptId) {
                return majField ? { ...base, [majField]: true } : base;
            }

            if (!supportsDept) return base;

            return { 
                ...base, 
                AND: [
                    { OR: [
                        { departmentId: userDeptId }, 
                        ...(majField ? [{ [majField]: true }] : [])
                    ] }
                ]
            };
        };

        console.log(`[SYNC_REQUEST] User: ${userId} (${role}), Module: ${module}, Since: ${since || 'Beginning'}`);

        let result: any = [];

        try {
            switch (module) {
                case 'projects':
                    result = await prisma.project.findMany({ 
                        where: getStandardWhere(),
                        orderBy: { updatedAt: 'desc' }
                    });
                    break;

                case 'events':
                    result = await prisma.event.findMany({ 
                        where: getStandardWhere(),
                        orderBy: { updatedAt: 'desc' }
                    });
                    break;

                case 'plans':
                    result = await prisma.plan.findMany({ 
                        where: getStandardWhere(),
                        orderBy: { updatedAt: 'desc' }
                    });
                    break;

                case 'announcements':
                    result = await prisma.announcement.findMany({ 
                        where: getStandardWhere({ majField: 'isGlobal' }),
                        orderBy: { updatedAt: 'desc' }
                    });
                    break;

                case 'members':
                    if (!isAdmin && role !== 'DEPARTMENT_LEADER') {
                        return res.status(403).json({ error: 'Forbidden: Insufficient visibility for personnel registry.' });
                    }
                    result = await prisma.user.findMany({
                        where: {
                            AND: [
                                { OR: [{ updatedAt: { gt: timestamp } }, { deletedAt: { gt: timestamp } }] },
                                effectiveDeptId ? { departmentId: effectiveDeptId as string } : {}
                            ]
                        },
                        select: { id: true, name: true, membershipNumber: true, role: true, departmentId: true, status: true, updatedAt: true, deletedAt: true }
                    });
                    break;

                case 'finance':
                    if (isAdmin) {
                        result = await prisma.transaction.findMany({
                            where: {
                                OR: [{ updatedAt: { gt: timestamp } }, { deletedAt: { gt: timestamp } }]
                            },
                            orderBy: { updatedAt: 'desc' }
                        });
                    } else {
                        result = await prisma.transaction.findMany({
                            where: {
                                requestedById: userId,
                                OR: [{ updatedAt: { gt: timestamp } }, { deletedAt: { gt: timestamp } }]
                            },
                            orderBy: { updatedAt: 'desc' }
                        });
                    }
                    break;

                case 'meetings':
                    result = await prisma.meeting.findMany({ 
                        where: {
                            OR: [{ updatedAt: { gt: timestamp } }, { deletedAt: { gt: timestamp } }],
                            ...(isAdmin ? (effectiveDeptId ? { departmentId: effectiveDeptId } : {}) : (userDeptId ? { departmentId: userDeptId } : {}))
                        },
                        orderBy: { updatedAt: 'desc' }
                    });
                    break;

                case 'devotions':
                    result = await prisma.devotion.findMany({ 
                        where: getStandardWhere({ majField: null, supportsDept: false }),
                        orderBy: { updatedAt: 'desc' }
                    });
                    break;

                case 'messages':
                    result = (prisma as any).message ? await (prisma as any).message.findMany({ 
                        where: {
                            createdAt: { gt: timestamp },
                            ...(isAdmin ? (effectiveDeptId ? { departmentId: effectiveDeptId } : {}) : (userDeptId ? { departmentId: userDeptId } : {}))
                        },
                        orderBy: { createdAt: 'desc' }
                    }) : [];
                    break;

                case 'baptisms':
                    result = await prisma.baptism.findMany({
                        where: isAdmin ? {
                            OR: [{ updatedAt: { gt: timestamp } }, { deletedAt: { gt: timestamp } }]
                        } : {
                            userId,
                            OR: [{ updatedAt: { gt: timestamp } }, { deletedAt: { gt: timestamp } }]
                        },
                        include: { user: { include: { department: true } } },
                        orderBy: { updatedAt: 'desc' }
                    });
                    break;

                case 'children':
                    result = await (prisma as any).child.findMany({
                        where: isAdmin ? {
                            OR: [{ updatedAt: { gt: timestamp } }, { deletedAt: { gt: timestamp } }]
                        } : {
                            parentId: userId,
                            OR: [{ updatedAt: { gt: timestamp } }, { deletedAt: { gt: timestamp } }]
                        },
                        include: { department: true, parent: true },
                        orderBy: { updatedAt: 'desc' }
                    });
                    break;

                case 'repairs':
                    result = await prisma.technicalRepair.findMany({
                        where: isAdmin ? {
                            updatedAt: { gt: timestamp }
                        } : {
                            requesterId: userId,
                            updatedAt: { gt: timestamp }
                        },
                        include: { department: true, requester: true, approvals: { include: { user: true } } },
                        orderBy: { updatedAt: 'desc' }
                    });
                    break;

                case 'appointments':
                    result = await prisma.appointment.findMany({
                        where: isAdmin ? {
                            updatedAt: { gt: timestamp }
                        } : {
                            OR: [
                                { memberId: userId },
                                { targetId: userId }
                            ],
                            updatedAt: { gt: timestamp }
                        },
                        include: { member: true, target: true },
                        orderBy: { updatedAt: 'desc' }
                    });
                    break;

                case 'partnerships':
                    result = await prisma.partnership.findMany({
                        where: isAdmin ? {
                            OR: [{ updatedAt: { gt: timestamp } }, { deletedAt: { gt: timestamp } }]
                        } : {
                            userId,
                            OR: [{ updatedAt: { gt: timestamp } }, { deletedAt: { gt: timestamp } }]
                        },
                        include: { user: { include: { department: true } }, ledgers: true },
                        orderBy: { updatedAt: 'desc' }
                    });
                    break;

                case 'departments':
                    result = await prisma.department.findMany({
                        where: { OR: [{ updatedAt: { gt: timestamp } }, { deletedAt: { gt: timestamp } }] },
                        orderBy: { updatedAt: 'desc' }
                    });
                    break;

                default:
                    return res.status(400).json({ error: `Module '${module}' is not a registered sync stream.` });
            }
        } catch (queryError: any) {
            console.error(`[MODULE_QUERY_FAILURE] ${module}:`, queryError);
            throw queryError; // Re-throw to be caught by main handler
        }

        console.log(`[SYNC_SUCCESS] Module: ${module}, Records: ${result.length}`);
        
        res.json({
            module,
            timestamp: new Date().toISOString(),
            count: result.length,
            data: result
        });

    } catch (error: any) {
        console.error('[DELTA_SYNC_CRITICAL_FAILURE]', error);
        res.status(500).json({ 
            error: 'Mission synchronization failed.', 
            details: error.message,
            code: error.code || 'UNKNOWN'
        });
    }
};
