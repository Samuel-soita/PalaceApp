import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';
import { getOrSetCache, getCachedData, setCachedData, invalidateCache } from '../../utils/redis.js';
import { hasPermission } from '../../utils/permissions.js';
import { catchAsync, AppError } from '../../utils/errors.js';

export const createDepartment = catchAsync(async (req: any, res: Response) => {
    const { name, description, leaderId } = req.body;

    const department = await prisma.department.create({
        data: { name, description, leaderId },
    });

    // Invalidate Cache
    await invalidateCache('departments:*');
    
    if (req.user?.id) {
        await logAudit(req.user.id, 'DEPARTMENT_CREATED', 'SYSTEM', department.id, { name });
    }

    res.status(201).json(department);
});

export const getDepartments = catchAsync(async (req: Request, res: Response) => {
    const cacheKey = 'departments:all';
    const departments = await getOrSetCache(cacheKey, async () => {
        return prisma.department.findMany({
            include: { leaders: { select: { id: true, name: true } } }
        });
    }, 300); // 5 minute cache
    res.json(departments);
});

export const getDepartmentById = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const department = await prisma.department.findUnique({
        where: { id },
        include: {
            leaders: { select: { id: true, name: true } },
            meetings: true
        }
    });
    
    if (!department) throw new AppError('Department not found', 404);
    
    res.json(department);
});

export const getUsheringTally = catchAsync(async (req: Request, res: Response) => {
    const canViewPersonnel = hasPermission((req as any).user, 'VIEW_PERSONNEL');

    const cacheKey = 'ushering:tally';
    let tally: any = await getCachedData(cacheKey);

    if (!tally) {
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

        tally = {
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
    }

    // --- MEMBER PRIVACY LOCKDOWN ---
    // If the user lacks clearance, mutate the response to strip PII and raw profiles.
    if (!canViewPersonnel) {
        delete tally.details;
    }

    res.json(tally);
});
