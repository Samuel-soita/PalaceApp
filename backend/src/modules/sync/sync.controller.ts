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
        const getStandardWhere = (options: { majField?: string | null, supportsDept?: boolean, supportsSoftDelete?: boolean, modelName?: string } = {}) => {
            const { majField = 'isMajor', supportsDept = true, supportsSoftDelete = true, modelName } = options;
            
            // 1. ADMINISTRATIVE OVERRIDE: Global oversight for Bishop, Systems Admin, and Watua engineers
            if (['SUPER_ADMIN', 'SYSTEM_ADMIN', 'WATUA', 'BISHOP'].includes(role)) {
                return {
                    AND: [
                        { OR: [
                            { updatedAt: { gt: timestamp } },
                            ...(supportsSoftDelete ? [{ deletedAt: { gt: timestamp } }] : [])
                        ]}
                    ]
                };
            }

            // Core visibility conditions (OR block)
            const visibilityConditions: any[] = [];
            
            // Model-specific originator fields
            if (modelName === 'Announcement' || modelName === 'Devotion') {
                visibilityConditions.push({ authorId: userId });
            } else if (modelName === 'Meeting') {
                visibilityConditions.push({ organizerId: userId });
            } else if (modelName === 'Transaction') {
                visibilityConditions.push({ requestedById: userId });
            } else if (modelName === 'TechnicalRepair') {
                visibilityConditions.push({ requesterId: userId });
            } else if (['Project', 'Event', 'Plan'].includes(modelName as string)) {
                visibilityConditions.push({ createdById: userId });
            }

            // 2. ALWAYS allow assigned authorizers to see missions for approval
            if (['Project', 'Event', 'Plan', 'Meeting', 'Announcement', 'Transaction', 'TechnicalRepair'].includes(modelName as string)) {
                visibilityConditions.push({ approvals: { some: { userId } } });
            }
            
            if (['Project', 'Event', 'Plan', 'Meeting', 'Announcement'].includes(modelName as string)) {
                visibilityConditions.push({ targetPastorId: userId });
            }
            
            if (supportsDept) {
                if (effectiveDeptId) {
                    visibilityConditions.push({ departmentId: effectiveDeptId });
                } else if (userDeptId) {
                    visibilityConditions.push({ departmentId: userDeptId });
                }
            }

            if (majField) {
                visibilityConditions.push({ [majField]: true });
            }

            // Final where clause: (Any Visibility Condition) AND (Recently Updated or Deleted)
            return {
                AND: [
                    { OR: visibilityConditions },
                    {
                        OR: [
                            { updatedAt: { gt: timestamp } },
                            ...(supportsSoftDelete ? [{ deletedAt: { gt: timestamp } }] : [])
                        ]
                    }
                ]
            };
        };

        console.log(`[SYNC_REQUEST] User: ${userId} (${role}), Module: ${module}, Since: ${since || 'Beginning'}`);

        let result: any = [];

        try {
            switch (module) {
                case 'projects':
                    result = await prisma.project.findMany({ 
                        where: getStandardWhere({ modelName: 'Project' }),
                        include: { approvals: true, department: { select: { name: true } } },
                        orderBy: { updatedAt: 'desc' }
                    });
                    break;

                case 'events':
                    result = await prisma.event.findMany({ 
                        where: getStandardWhere({ modelName: 'Event' }),
                        include: { approvals: true, department: { select: { name: true } } },
                        orderBy: { updatedAt: 'desc' }
                    });
                    break;

                case 'plans':
                    result = await prisma.plan.findMany({ 
                        where: getStandardWhere({ modelName: 'Plan' }),
                        include: { approvals: true, department: { select: { name: true } } },
                        orderBy: { updatedAt: 'desc' }
                    });
                    break;

                case 'announcements':
                    result = await prisma.announcement.findMany({ 
                        where: getStandardWhere({ majField: 'isGlobal', modelName: 'Announcement' }),
                        include: { approvals: true, department: { select: { name: true } } },
                        orderBy: { updatedAt: 'desc' }
                    });
                    break;

                case 'members':
                    // Graceful Degradation: If not a leader/admin, return empty instead of 403
                    // to keep the PWA sync loop healthy for missions.
                    if (!isAdmin && role !== 'DEPARTMENT_LEADER') {
                        result = []; 
                    } else {
                        result = await prisma.user.findMany({
                            where: {
                                AND: [
                                    { OR: [{ updatedAt: { gt: timestamp } }, { deletedAt: { gt: timestamp } }] },
                                    {
                                        OR: [
                                            effectiveDeptId ? { departmentId: effectiveDeptId as string } : {},
                                            { role: { in: ['PASTOR', 'ASSOCIATE_PASTOR'] } }
                                        ]
                                    }
                                ]
                            },
                            select: { 
                                id: true, 
                                name: true, 
                                membershipNumber: true, 
                                role: true, 
                                departmentId: true, 
                                status: true, 
                                idNumber: true, 
                                dob: true, 
                                gender: true, 
                                isCardPaid: true, 
                                isSuspended: true, 
                                avatarUrl: true, 
                                wrongdoingCount: true, 
                                updatedAt: true, 
                                deletedAt: true 
                            }
                        });
                    }
                    break;

                case 'finance':
                    result = await prisma.transaction.findMany({ 
                        where: getStandardWhere({ modelName: 'Transaction', majField: null }),
                        include: { approvals: true, requester: { select: { name: true } } },
                        orderBy: { updatedAt: 'desc' }
                    });
                    break;

                case 'meetings':
                    result = await prisma.meeting.findMany({ 
                        where: getStandardWhere({ modelName: 'Meeting', majField: null }),
                        include: { approvals: true, department: { select: { name: true } } },
                        orderBy: { updatedAt: 'desc' }
                    });
                    break;

                case 'devotions':
                    result = await prisma.devotion.findMany({ 
                        where: getStandardWhere({ majField: null, supportsDept: false, modelName: 'Devotion' }),
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
                    result = (prisma as any).technicalRepair ? await (prisma as any).technicalRepair.findMany({
                        where: getStandardWhere({ modelName: 'TechnicalRepair', majField: null }),
                        include: { department: true, requester: { select: { name: true, role: true } }, approvals: { include: { user: { select: { name: true, role: true } } } } },
                        orderBy: { updatedAt: 'desc' }
                    }) : [];
                    break;

                case 'appointments':
                    result = (prisma as any).appointment ? await (prisma as any).appointment.findMany({
                        where: (role === 'SUPER_ADMIN') ? {
                            OR: [{ updatedAt: { gt: timestamp } }, { deletedAt: { gt: timestamp } }]
                        } : {
                            OR: [
                                { memberId: userId },
                                { targetId: userId },
                                { targetRole: 'SUPER_ADMIN' }
                            ],
                            AND: [
                                { OR: [{ updatedAt: { gt: timestamp } }, { deletedAt: { gt: timestamp } }] }
                            ]
                        },
                        include: { member: { select: { name: true, role: true } }, target: { select: { name: true, role: true } } },
                        orderBy: { updatedAt: 'desc' }
                    }) : [];
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
                
                case 'reports':
                    result = await prisma.departmentReport.findMany({
                        where: isAdmin ? {
                            updatedAt: { gt: timestamp }
                        } : {
                            submittedById: userId,
                            updatedAt: { gt: timestamp }
                        },
                        include: { department: true, submittedBy: { select: { name: true, role: true } } },
                        orderBy: { updatedAt: 'desc' }
                    });
                    break;

                case 'support_requests':
                    result = await prisma.supportRequest.findMany({
                        where: isAdmin ? {
                            updatedAt: { gt: timestamp }
                        } : {
                            requesterId: userId,
                            updatedAt: { gt: timestamp }
                        },
                        include: { event: true, requester: { select: { name: true, role: true } } },
                        orderBy: { updatedAt: 'desc' }
                    });
                    break;

                case 'audit_logs':
                    // Critical Watua Oversight Stream
                    if (role === 'WATUA' || role === 'SUPER_ADMIN') {
                        result = await prisma.auditLog.findMany({
                            where: { createdAt: { gt: timestamp } },
                            include: { actor: { select: { name: true, role: true } } },
                            orderBy: { createdAt: 'desc' },
                            take: 100 // Limit for sync performance
                        });
                    } else {
                        result = [];
                    }
                    break;

                default:
                    return res.status(400).json({ error: `Module '${module}' is not a registered sync stream.` });
            }
        } catch (queryError: any) {
            console.error(`[MODULE_QUERY_FAILURE] ${module}:`, {
                message: queryError.message,
                code: queryError.code,
                meta: queryError.meta,
                stack: queryError.stack
            });
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
        console.error('[DELTA_SYNC_CRITICAL_FAILURE]', {
            module: req.params.module,
            userId: req.user?.id,
            error: error.message,
            stack: error.stack
        });
        
        // Map Prisma errors to readable messages
        let errorMessage = `Mission synchronization failed for ${req.params.module}.`;
        if (error.code === 'P2002') errorMessage = 'Sync Conflict: Unique constraint failed.';
        if (error.code === 'P2025') errorMessage = 'Record not found for synchronization.';
        
        res.status(500).json({ 
            error: errorMessage, 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            code: error.code || 'UNKNOWN',
            module: req.params.module
        });
    }
};
