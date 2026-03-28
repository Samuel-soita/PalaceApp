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
        const getStandardWhere = (majField: string = 'isMajor') => {
            const base: any = { 
                OR: [
                    { updatedAt: { gt: timestamp } },
                    { deletedAt: { gt: timestamp } }
                ]
            };
            
            if (isAdmin) {
                if (effectiveDeptId) base.departmentId = effectiveDeptId;
                return base;
            }
            
            if (!userDeptId) {
                return { ...base, [majField]: true };
            }

            return { 
                ...base, 
                AND: [
                    { OR: [{ departmentId: userDeptId }, { [majField]: true }] }
                ]
            };
        };

        let result: any = [];

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
                    where: getStandardWhere('isGlobal'),
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
                // Only accessible by owner, Admin, or Pastor with clearance
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

            default:
                return res.status(400).json({ error: `Module '${module}' is not a registered sync stream.` });
        }

        res.json({
            module,
            timestamp: new Date().toISOString(),
            count: result.length,
            data: result
        });

    } catch (error: any) {
        console.error('[DELTA_SYNC_FAILURE]', error);
        res.status(500).json({ error: 'Mission synchronization failed.', details: error.message });
    }
};
