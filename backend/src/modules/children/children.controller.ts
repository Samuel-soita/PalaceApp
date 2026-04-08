import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import prisma from '../../utils/prisma.js';
import { logAction } from '../../utils/audit.service.js';
import { findTargetDepartmentId } from '../../utils/department-mapper.js';
import redis, { getCachedData, setCachedData, invalidateCache } from '../../utils/redis.js';

export const registerChild = async (req: AuthRequest, res: Response) => {
    const { name, dob, gender, branch = 'HQ', isDedicated = false, dedicationCardNumber = null } = req.body;
    const parentId = req.user!.id;

    if (!name || !dob || !gender) {
        return res.status(400).json({ error: 'Name, Date of Birth, and Gender are required.' });
    }

    try {
        // --- Duplicate Check (Strict: Same Parent + Same Name + Same DOB) ---
        const existingChild = await prisma.child.findFirst({
            where: {
                name: { equals: name, mode: 'insensitive' },
                dob: new Date(dob),
                parentId
            }
        });

        if (existingChild) {
            return res.status(409).json({ error: 'This child is already registered under your profile.' });
        }

        // --- Generate Atomic Dedication Number (Concurrency-Safe) ---
        let counter = await redis.incr('children:dedication:counter');
        if (counter === 1) {
            // First time use or Redis reset - sync with DB count
            const dbCount = await prisma.child.count();
            if (dbCount > 0) {
                await redis.set('children:dedication:counter', dbCount + 1);
                counter = dbCount + 1;
            }
        }
        
        const formattedDob = new Date(dob).toISOString().split('T')[0].replace(/-/g, '');
        const dedicationNumber = `| ${counter.toString().padStart(3, '0')} | ${formattedDob} | ${branch.toUpperCase()}`;

        // --- Department Mapping ---
        const departmentId = await findTargetDepartmentId(new Date(dob), gender);

        // --- Create Child ---
        const child = await (prisma as any).child.create({
            data: {
                name,
                dob: new Date(dob),
                gender: gender.toUpperCase(),
                dedicationNumber,
                isDedicated,
                dedicationCardNumber,
                parentId,
                branch,
                departmentId,
                assignedPastorId: req.body.assignedPastorId || null,
                workflowStatus: isDedicated ? 'DEDICATED' : 'PENDING_DEDICATION'
            }
        });

        await logAction({
            actorId: parentId,
            actionType: 'REGISTER_CHILD',
            entityType: 'CHILD',
            entityId: child.id,
            metadata: { name, dedicationNumber, assignedPastorId: req.body.assignedPastorId }
        });
        await invalidateCache('ushering:tally');
        await invalidateCache('children:list:*');

        res.status(201).json({
            message: 'Child registered successfully.',
            child
        });
    } catch (error: any) {
        console.error('[Register Child Error]', error);
        res.status(500).json({ error: 'Failed to register child.' });
    }
};

export const getMyChildren = async (req: AuthRequest, res: Response) => {
    try {
        const children = await prisma.child.findMany({
            where: { 
                parentId: req.user!.id,
                deletedAt: null // MISSION INTEGRITY: Exclude soft-deleted
            },
            include: { department: true }
        });
        res.json(children);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch children.' });
    }
};

export const getAllChildren = async (req: AuthRequest, res: Response) => {
    // Only high roles
    if (!['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'WATUA', 'PASTOR', 'ASSOCIATE_PASTOR', 'DEPARTMENT_LEADER'].includes(req.user!.role)) {
        return res.status(403).json({ error: 'Unauthorized.' });
    }

    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);
    const cacheKey = `children:list:p${page}:l${limit}`;

    try {
        const cachedData = await getCachedData(cacheKey);
        // Skip cache for pastors to ensure they see real-time assignments
        if (cachedData && (req.user as any).role !== 'PASTOR') return res.json(cachedData);

        const where: any = { deletedAt: null }; // GLOBAL EXCLUSION OF SOFT-DELETED
        
        // 🔒 PASTORAL SCOPING: Only see assigned children OR unassigned dedication pipeline
        if (req.user!.role === 'PASTOR' || req.user!.role === 'ASSOCIATE_PASTOR') {
            where.OR = [
                { assignedPastorId: req.user!.id },
                { 
                    assignedPastorId: null,
                    workflowStatus: { in: ['PENDING_DEDICATION', 'ADMIN_PAYMENT_VERIFICATION', 'BISHOP_RITE_PENDING'] }
                }
            ];
        }

        const [children, total] = await Promise.all([
            (prisma as any).child.findMany({
                where,
                skip,
                take,
                include: { 
                    parent: true,
                    department: true,
                    assignedPastor: { select: { id: true, name: true, role: true } }
                },
                orderBy: { createdAt: 'desc' }
            }),
            (prisma as any).child.count({ where })
        ]);

        const response = {
            data: children,
            meta: {
                total,
                page: Number(page),
                limit: take,
                totalPages: Math.ceil(total / take)
            }
        };

        await setCachedData(cacheKey, response, 120);
        res.json(response);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch children.' });
    }
};
