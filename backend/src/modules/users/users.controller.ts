import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';
import { logAction } from '../../utils/audit.service.js';
import { findTargetDepartmentId } from '../../utils/department-mapper.js';
import { getOrSetCache, invalidateCache } from '../../utils/redis.js';
import { RecoveryService } from '../../utils/recovery.service.js';

export const getUsers = async (req: Request, res: Response) => {
    try {
        const { role, page = '1', limit: qLimit = '20' } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(qLimit);
        const skip = (pageNum - 1) * limitNum;
        const take = limitNum;

        const whereClause: any = role ? { role: String(role) } : {};
        whereClause.deletedAt = null; 
        
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where: whereClause,
                skip,
                take,
                select: {
                    id: true,
                    name: true,
                    role: true,
                    departmentId: true,
                    status: true,
                    membershipNumber: true
                }
            }),
            prisma.user.count({ where: whereClause })
        ]);
        
        res.json({
            data: users,
            meta: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const getPendingUsers = async (req: Request, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { status: 'PENDING' },
                    { deletionRequested: true }
                ]
            },
            select: {
                id: true,
                name: true,
                idNumber: true,
                membershipNumber: true,
                isCardPaid: true as any,
                role: true,
                createdAt: true,
                avatarUrl: true,
                status: true,
                deletionRequested: true,
                isPartner: true as any,
                department: { select: { name: true } }
            }
        });
        res.json(users);
    } catch (error: any) {
        console.error('[TECHNICAL ERROR] getPendingUsers failed:', error);
        res.status(500).json({ error: 'Failed to fetch pending actions' });
    }
};

export const activateUser = async (req: any, res: Response) => {
    const { id } = req.params;
    const { status } = req.body; // ACTIVE or REJECTED

    try {
        const currentUser = await prisma.user.findUnique({ where: { id } });
        if (!currentUser) return res.status(404).json({ error: 'User not found' });

        if (status === 'REJECTED') {
            if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'WATUA') {
                return res.status(403).json({ error: 'Hard Boundaries: SYSTEM_ADMIN cannot permanently purge user accounts. Only SUPER_ADMIN (Bishop) can execute purges.' });
            }

            // If it was a deletion request, we just reset the flag
            if (currentUser.deletionRequested) {
                await prisma.user.update({ where: { id }, data: { deletionRequested: false } });
                await logAudit(req.user.id, 'REJECT_DELETION', 'USER', id, { name: currentUser.name });
                return res.json({ message: 'Account deletion request rejected.' });
            }

            // Otherwise it's a new registration rejection - soft-delete
            const user = await RecoveryService.softDelete(prisma.user as any, id, req.user.id, 'REGISTRATION_REJECTED');
            await logAudit(req.user.id, 'REJECT_REGISTRATION', 'USER', id, { name: (user as any).name });
            return res.json({ message: 'User registration rejected (Soft-Deleted).' });
        }

        // If it was a deletion request and we approve
        if (currentUser.deletionRequested && status === 'ACTIVE') {
            if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'WATUA') {
                return res.status(403).json({ error: 'Hard Boundaries: SYSTEM_ADMIN cannot execute primary account purges. Only SUPER_ADMIN (Bishop) can execute soft-deletions.' });
            }

            // Soft-delete the account as requested
            await RecoveryService.softDelete(prisma.user as any, id, req.user.id, 'USER_REQUESTED_DELETION');
            await logAudit(req.user.id, 'APPROVE_DELETION', 'USER', id, { name: currentUser.name });
            await invalidateCache('users:*');
            return res.json({ message: 'Account soft-deleted as requested.' });
        }

        // Normal activation for PENDING users
        if (!(currentUser as any).isCardPaid) {
            return res.status(403).json({ 
                error: 'Membership card payment not verified. Activation denied.',
                reason: 'PAYMENT_PENDING'
            });
        }

        const user = await prisma.user.update({
            where: { id },
            data: { 
                status: 'ACTIVE',
                authenticatedAt: new Date(),
                authenticatedById: req.user.id,
                deletionRequested: false
            }
        });

        await logAudit(req.user.id, 'ACTIVATE', 'USER', id, { name: user.name });

        await prisma.notification.create({
            data: {
                userId: id,
                title: '✅ Account Activated',
                message: 'Your membership card has been verified. Welcome to ChurchHub Command.'
            }
        });

        await invalidateCache('users:*'); // Invalidate cache on status change

        res.json({ message: 'User activated successfully.', user });
    } catch (error: any) {
        console.error('[TECHNICAL ERROR] activateUser failed:', error);
        res.status(400).json({ error: 'Failed to update user status' });
    }
};

export const markCardAsPaid = async (req: any, res: Response) => {
    const { id } = req.params;
    const { isPaid } = req.body;

    try {
        const user = await prisma.user.update({
            where: { id },
            data: { isCardPaid: isPaid } as any
        });

        await logAudit(req.user.id, isPaid ? 'CARD_PAYMENT_VERIFIED' : 'CARD_PAYMENT_REVERSED', 'USER', id, { name: user.name });

        res.json({ message: `Membership card payment status updated for ${user.name}.`, user });
    } catch (error: any) {
        console.error('[TECHNICAL ERROR] markCardAsPaid failed:', error);
        res.status(500).json({ error: 'Failed to update payment status' });
    }
};
// Watua Technical Retrieval
export const getUsersTechnical = async (req: any, res: Response) => {
    try {
        const { page = '1', limit = '50', search = '' } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        const where: any = {};
        if (search) {
            where.OR = [
                { name: { contains: String(search) } },
                { membershipNumber: { contains: String(search) } },
                { idNumber: { contains: String(search) } },
            ];
        }
        where.deletedAt = null; // Only non-deleted users

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    role: true,
                    status: true,
                    isSuspended: true,
                    membershipNumber: true,
                    wrongdoingCount: true,
                    dob: true,
                    gender: true,
                    idNumber: true,
                    department: {
                        select: {
                            name: true
                        }
                    },
                    createdAt: true
                }
            }),
            prisma.user.count({ where })
        ]);

        res.json({
            data: users,
            meta: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error) {
        console.error('[getUsersTechnical Error]', error);
        res.status(500).json({ error: 'Failed to access entity register' });
    }
};

export const getSystemStats = async (req: any, res: Response) => {
    try {
        const stats = await getOrSetCache('system:stats', async () => {
            const [userCount, pendingCount, leaderCount, projectCount, eventCount, deptCount] = await Promise.all([
                prisma.user.count(),
                prisma.user.count({ where: { status: 'PENDING' } }),
                prisma.user.count({ where: { role: 'DEPARTMENT_LEADER' } }),
                prisma.project.count(),
                prisma.event.count(),
                prisma.department.count()
            ]);

            return {
                users: { total: userCount, pending: pendingCount, leaders: leaderCount },
                operations: { projects: projectCount, events: eventCount, departments: deptCount },
                health: 'OPTIMAL',
                kernelVersion: '2.4.0-CHURCHHUB'
            };
        }, 60); // 1 minute cache

        res.json(stats);
    } catch (error) {
        console.error('[TECHNICAL ERROR] getSystemStats failed:', error);
        res.status(500).json({ error: 'Failed to retrieve system metrics' });
    }
};

export const updateUserBioTechnical = async (req: any, res: Response) => {
    const { id } = req.params;
    const { name, idNumber, dob, gender } = req.body;

    try {
        const currentUser = await prisma.user.findUnique({ where: { id } });
        if (!currentUser) return res.status(404).json({ error: 'User not found' });

        const updateData: any = {
            ...(name && { name }),
            ...(idNumber && { idNumber }),
            ...(dob && { dob: new Date(dob) }),
            ...(gender && { gender })
        };

        // --- Automatic Department Reassignment (Only for Members) ---
        if (currentUser.role === 'MEMBER' && (dob || gender)) {
            const finalDob = dob ? new Date(dob) : currentUser.dob;
            const finalGender = gender || currentUser.gender;

            if (finalDob && finalGender) {
                const newDeptId = await findTargetDepartmentId(finalDob, finalGender);
                if (newDeptId && newDeptId !== currentUser.departmentId) {
                    updateData.departmentId = newDeptId;
                }
            }
        }

        const current = await prisma.user.findUnique({ where: { id } });
        const updated = await prisma.user.update({
            where: { id },
            data: updateData
        });

        await logAction({
            actorId: req.user.id,
            actorRole: req.user.role,
            actionType: 'TECHNICAL_REPAIR',
            entityType: 'USER_BIO',
            entityId: id,
            beforeState: current,
            afterState: updated,
            ipAddress: req.ip
        });
        res.json(updated);
    } catch (error: any) {
        console.error('[TECHNICAL ERROR] updateUserBioTechnical failed:', error);
        res.status(400).json({ error: error.message || 'Failed to execute bio repair' });
    }
};

export const getSystemDiagnostics = async (req: any, res: Response) => {
    try {
        const logs = await (prisma.auditLog as any).findMany({
            take: 100,
            orderBy: { createdAt: 'desc' },
            include: { actor: { select: { name: true } } }
        });

        // Mocking failure analysis - in a real app, this would query a dedicated error log table
        res.json({
            status: 'HEALTHY',
            uptime: Math.floor(process.uptime()),
            recentLogs: logs,
            lastIntervention: logs[0]?.createdAt || null
        });
    } catch (error: any) {
        console.error('[TECHNICAL ERROR] getSystemDiagnostics failed:', error);
        res.status(500).json({ error: 'Failed to access diagnostics' });
    }
};

export const getAuditLogsTechnical = async (req: any, res: Response) => {
    try {
        const logs = await (prisma.auditLog as any).findMany({
            include: { actor: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        res.json(logs);
    } catch (error) {
        console.error('[TECHNICAL ERROR] getAuditLogsTechnical failed:', error);
        res.status(500).json({ error: 'Failed to access intervention records' });
    }
};

export const getTrashHub = async (req: any, res: Response) => {
    try {
        const trash = await RecoveryService.getTrashBin();
        res.json(trash);
    } catch (error: any) {
        console.error('[TECHNICAL ERROR] getTrashHub failed:', error);
        res.status(500).json({ error: 'Failed to retrieve trash bin' });
    }
};

export const restoreEntity = async (req: any, res: Response) => {
    const { id } = req.params;
    const { type } = req.body;
    try {
        await RecoveryService.restore(type, id, req.user.id);
        res.json({ message: 'Resource successfully restored to system kernel.' });
    } catch (error: any) {
        console.error('[TECHNICAL ERROR] restoreEntity failed:', error);
        res.status(500).json({ error: 'Restoration failed' });
    }
};

export const getFeatureFlags = async (req: any, res: Response) => {
    try {
        const flags = await (prisma as any).featureFlag.findMany();
        res.json(flags);
    } catch (error: any) {
        console.error('[TECHNICAL ERROR] getFeatureFlags failed:', error);
        res.status(500).json({ error: 'Failed to retrieve feature flags' });
    }
};

export const updateFeatureFlag = async (req: any, res: Response) => {
    const { name, enabled, scope } = req.body;
    try {
        const flag = await (prisma as any).featureFlag.update({
            where: { name },
            data: { enabled, scope }
        });
        await invalidateCache('system:feature_flags');
        res.json(flag);
    } catch (error) {
        res.status(500).json({ error: 'Failed to commit feature flag update.' });
    }
};

// Watua System Intervention
export const executeIntervention = async (req: any, res: Response) => {
    const { id } = req.params;
    const { action, departmentId } = req.body;

    try {
        let updateData: any = {};
        let auditAction = `INTERVENTION_${action}`;

        switch (action) {
            case 'ACTIVATE':
                updateData = { status: 'ACTIVE' };
                break;
            case 'PROMOTE_LEADER':
                if (req.user.role !== 'WATUA' && req.user.role !== 'SUPER_ADMIN') {
                    return res.status(403).json({ error: 'Only the Bishop or System Engineer can appoint leaders.' });
                }
                if (!departmentId) return res.status(400).json({ error: 'Department selection is mandatory for leadership appointments.' });
                updateData = { role: 'DEPARTMENT_LEADER', departmentId };
                break;
            case 'DEMOTE_MEMBER':
                if (req.user.role !== 'WATUA' && req.user.role !== 'SUPER_ADMIN') {
                    return res.status(403).json({ error: 'Only the Bishop or System Engineer can demote leaders.' });
                }
                updateData = { role: 'MEMBER', departmentId: null };
                break;
            case 'MAKE_SUPER_ADMIN':
                if (req.user.role !== 'WATUA') return res.status(403).json({ error: 'Only the System Engineer can appoint a new Super Admin.' });
                updateData = { role: 'SUPER_ADMIN', departmentId: null };
                break;
            case 'MAKE_SYSTEM_ADMIN':
                if (req.user.role !== 'WATUA' && req.user.role !== 'SUPER_ADMIN') {
                    return res.status(403).json({ error: 'Only the Bishop or System Engineer can appoint Administrators.' });
                }
                updateData = { role: 'SYSTEM_ADMIN', departmentId: null };
                break;
            case 'MAKE_SECRETARY':
                if (req.user.role !== 'WATUA' && req.user.role !== 'SUPER_ADMIN') {
                    return res.status(403).json({ error: 'Only the Bishop or System Engineer can appoint Secretaries.' });
                }
                updateData = { role: 'SECRETARY', departmentId: null };
                break;
            case 'SUSPEND':
                updateData = { isSuspended: true };
                break;
            case 'UNSUSPEND':
                updateData = { isSuspended: false };
                break;
            case 'RESET_STRIKES':
                updateData = { wrongdoingCount: 0 };
                break;
            case 'TOGGLE_PARTNER':
                return res.status(403).json({ error: 'Manual toggling of Covenant Partnerships is strictly prohibited. Please process a valid financial transaction to update Partnership status.' });
            default:
                return res.status(400).json({ error: 'Invalid intervention code' });
        }

        const current = await prisma.user.findUnique({ where: { id } });
        const user = await prisma.user.update({
            where: { id },
            data: updateData
        });

        await logAction({
            actorId: req.user.id,
            actorRole: req.user.role,
            actionType: auditAction,
            entityType: 'USER',
            entityId: id,
            beforeState: current,
            afterState: user,
            metadata: { intervention: action, sector: departmentId || 'GLOBAL' },
            ipAddress: req.ip
        });

        res.json({ message: `Intervention ${action} successfully committed to database kernel.` });
    } catch (error) {
        res.status(500).json({ error: 'Database kernel rejected intervention.' });
    }
};

export const enrollPartnership = async (req: any, res: Response) => {
    const { id: userId } = req.user;
    const { amount } = req.body;

    if (!amount || amount < 700) {
        return res.status(400).json({ error: 'Partnership enrollment requires a minimum seed of 700 KES.' });
    }

    try {
        const [partnership, user] = await prisma.$transaction(async (tx) => {
            const p = await tx.partnership.create({
                data: {
                    userId,
                    amount,
                    balance: amount, // This implies a pending balance
                    paidAmount: 0,
                    frequency: 'MONTHLY',
                    status: 'ACTIVE' // Derived from ledger in future reads
                }
            });

            // Create initial enrollment trace ledger (Zero financial value, just proof of covenant)
            await (tx as any).partnershipLedger.create({
                data: {
                    partnershipId: p.id,
                    amount: 0,
                    transactionType: 'ENROLLMENT',
                    paymentMethod: 'SYSTEM',
                    referenceCode: `ENROLL-${userId.substring(0, 8).toUpperCase()}`,
                    status: 'VERIFIED'
                }
            });

            const u = await tx.user.update({
                where: { id: userId },
                data: { isPartner: true }
            });

            return [p, u];
        });

        await logAction({
            actorId: userId,
            actorRole: req.user.role,
            actionType: 'ENROLL_PARTNERSHIP',
            entityType: 'PARTNERSHIP',
            entityId: partnership.id,
            afterState: partnership,
            metadata: { ref: `COVENANT-${Date.now()}` },
            ipAddress: req.ip
        });

        res.json({ 
            message: 'Congratulations! You have been successfully enrolled as a Covenant Partner.',
            partnership,
            user: { isPartner: user.isPartner }
        });
    } catch (error) {
        console.error('Partnership Enrollment Error:', error);
        res.status(500).json({ error: 'Failed to process partnership enrollment.' });
    }
};
