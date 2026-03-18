import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';
import { getOrSetCache, getCachedData, setCachedData, invalidateCache } from '../../utils/redis.js';

export const createDepartment = async (req: any, res: Response) => {
    const { name, description, leaderId } = req.body;

    try {
        const department = await prisma.department.create({
            data: { name, description, leaderId },
        });

        // Invalidate Cache
        await invalidateCache('departments:*');

        res.status(201).json(department);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to create department' });
    }
};

export const getDepartments = async (req: Request, res: Response) => {
    try {
        const cacheKey = 'departments:all';
        const departments = await getOrSetCache(cacheKey, async () => {
            return prisma.department.findMany({
                include: { leaders: { select: { id: true, name: true } } }
            });
        }, 300); // 5 minute cache
        res.json(departments);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch departments' });
    }
};

export const getDepartmentById = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const department = await prisma.department.findUnique({
            where: { id },
            include: {
                leaders: { select: { id: true, name: true } },
                meetings: true,
                volunteers: true
            }
        });
        if (!department) return res.status(404).json({ error: 'Department not found' });
        res.json(department);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch department' });
    }
};

export const getUsheringTally = async (req: Request, res: Response) => {
    const cacheKey = 'ushering:tally';

    try {
        const cachedTally = await getCachedData(cacheKey);
        if (cachedTally) return res.json(cachedTally);

        const [users, children, departments] = await Promise.all([
            prisma.user.findMany({
                where: { role: { not: 'WATUA' } },
                include: { department: { select: { name: true } } },
                orderBy: { name: 'asc' }
            }),
            prisma.child.findMany({
                orderBy: { name: 'asc' }
            }),
            prisma.department.findMany({
                select: { id: true, name: true }
            })
        ]);

        const tally = {
            summary: {
                totalMembers: users.filter(u => u.role === 'MEMBER').length,
                totalLeaders: users.filter(u => u.role !== 'MEMBER').length,
                totalChildren: children.length,
                grandTotal: users.length + children.length
            },
            departmentBreakdown: departments.map(d => ({
                name: d.name,
                memberCount: users.filter(u => u.departmentId === d.id && u.role === 'MEMBER').length,
                leaderCount: users.filter(u => u.departmentId === d.id && u.role !== 'MEMBER').length
            })),
            details: {
                users: users.map(u => ({
                    id: u.id,
                    name: u.name,
                    role: u.role,
                    department: (u as any).department?.name,
                    membershipNumber: (u as any).membershipNumber,
                    phoneNumber: (u as any).phoneNumber,
                    status: (u as any).status,
                    children: children.filter(c => c.parentId === u.id).map(c => ({
                        id: c.id,
                        name: c.name,
                        age: Math.floor((new Date().getTime() - new Date(c.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
                    }))
                })),
                children: children.map(c => ({
                    id: c.id,
                    name: c.name,
                    age: Math.floor((new Date().getTime() - new Date(c.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25)),
                    dedicationNumber: c.dedicationNumber,
                    workflowStatus: c.workflowStatus,
                    parentId: c.parentId
                }))
            }
        };

        await setCachedData(cacheKey, tally, 30); // Cache for 30 seconds
        res.json(tally);
    } catch (error) {
        console.error('Ushering Tally Error:', error);
        res.status(500).json({ error: 'Failed to generate tally.' });
    }
};
