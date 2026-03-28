import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';

export const globalSearch = async (req: any, res: Response) => {
    const { q } = req.query;
    const { role, departmentId: userDeptId } = req.user;

    if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'System awaits search directive.' });
    }

    try {
        const queryStr = { contains: q, mode: 'insensitive' as const };
        const isGlobalExec = ['SUPER_ADMIN', 'WATUA', 'SYSTEM_ADMIN', 'PASTOR', 'SECRETARY'].includes(role);

        // --- Role Scoping Engine ---
        // Global Execs see the entire matrix. Local agents see only their sector or global missions.
        const getScoping = (isGlobalField: string = 'isMajor') => {
            if (isGlobalExec) return {};
            if (!userDeptId) return { [isGlobalField]: true }; // Unassigned users only see global
            return {
                OR: [
                    { departmentId: userDeptId },
                    { [isGlobalField]: true }
                ]
            };
        };

        const userScoping = () => {
             // For users, global execs can search the entire registry. 
             // Local agents can only search personnel in their own sector.
             if (isGlobalExec) return {};
             if (!userDeptId) return { id: 'NO_ACCESS' }; // Cannot see personnel if unassigned
             return { departmentId: userDeptId };
        };

        const [projects, events, announcements, users] = await Promise.all([
            prisma.project.findMany({
                where: {
                    AND: [
                        { OR: [{ title: queryStr }, { description: queryStr }] },
                        getScoping()
                    ]
                },
                take: 5
            }),
            prisma.event.findMany({
                where: {
                    AND: [
                        { OR: [{ title: queryStr }, { description: queryStr }, { location: queryStr }] },
                        getScoping()
                    ]
                },
                take: 5
            }),
            prisma.announcement.findMany({
                where: {
                    AND: [
                        { OR: [{ title: queryStr }, { content: queryStr }] },
                        getScoping('isGlobal')
                    ]
                },
                take: 5
            }),
            prisma.user.findMany({
                where: {
                    AND: [
                        { OR: [{ name: queryStr }, { membershipNumber: { contains: q } }] },
                        userScoping()
                    ]
                },
                select: { id: true, name: true, role: true, membershipNumber: true, status: true },
                take: 5
            })
        ]);

        res.json({
            projects,
            events,
            users,
            announcements
        });
    } catch (error: any) {
        console.error('[GLOBAL_SEARCH_ERROR]', error);
        res.status(500).json({ error: 'Search directive failed.' });
    }
};
