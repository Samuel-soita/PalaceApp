import { Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';
import { logAction } from '../../utils/audit.service.js';
import { findTargetDepartmentId } from '../../utils/department-mapper.js';
import { getOrSetCache, invalidateCache } from '../../utils/redis.js';
import { RecoveryService } from '../../utils/recovery.service.js';
import { catchAsync, AppError } from '../../utils/errors.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { generateNextMembershipNumber, isEligibleForRenewal } from '../../utils/user-utils.js';

/**
 * 👥 Fetch Users list with role filtering (Paginated)
 */
export const getUsers = catchAsync(async (req: AuthRequest, res: Response) => {
    const { role, page = '1', limit: qLimit = '20', excludeMembers } = req.query;
    const pageNum = Number(page);
    const limitNum = Number(qLimit);
    const skip = (pageNum - 1) * limitNum;
    const take = limitNum;

    const whereClause: any = { deletedAt: null };
    if (role) {
        whereClause.role = Array.isArray(role) ? { in: role.map(r => String(r)) } : String(role);
    }
    
    if (excludeMembers === 'true') {
        whereClause.role = { not: 'MEMBER' };
    }
    
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
});

/**
 * ⏳ Fetch Users awaiting admin action (Registrations & Deletions)
 */
export const getPendingUsers = catchAsync(async (req: AuthRequest, res: Response) => {
    const users = await prisma.user.findMany({
        where: {
            deletedAt: null,
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
            isCardPaid: true,
            role: true,
            createdAt: true,
            avatarUrl: true,
            status: true,
            deletionRequested: true,
            isPartner: true,
            department: { select: { name: true } }
        }
    });
    res.json(users);
});

/**
 * ✅ Activate New User or Approve Account Deletion
 */
export const activateUser = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body; // ACTIVE or REJECTED
    const actor = req.user!;

    const currentUser = await prisma.user.findUnique({ where: { id } });
    if (!currentUser) throw new AppError('User not found', 404);

    if (status === 'REJECTED') {
        if (['SUPER_ADMIN', 'WATUA'].includes(actor.role)) {
            if (currentUser.deletionRequested) {
                await prisma.user.update({ where: { id }, data: { deletionRequested: false } });
                await logAudit(actor.id, 'REJECT_DELETION', 'USER', id, { name: currentUser.name });
                return res.json({ message: 'Account deletion request rejected.' });
            }
            // Registration rejection -> Soft Delete
            await prisma.user.delete({ where: { id } }); // Extension handles soft-delete
            await logAudit(actor.id, 'REJECT_REGISTRATION', 'USER', id, { name: currentUser.name });
            return res.json({ message: 'User registration rejected and account decommissioned.' });
        }
        throw new AppError('Only the Bishop or System Engineer can purge or reject accounts.', 403);
    }

    // Process Deletion Approval
    if (currentUser.deletionRequested && status === 'ACTIVE') {
        if (!['SUPER_ADMIN', 'WATUA'].includes(actor.role)) {
            throw new AppError('Only the Bishop or System Engineer can execute account removals.', 403);
        }
        await prisma.user.delete({ where: { id } }); // Extension handles soft-delete
        await logAudit(actor.id, 'APPROVE_DELETION', 'USER', id, { name: currentUser.name });
        await invalidateCache('users:*');
        return res.json({ message: 'Account decommissioned as requested.' });
    }

    // Process Normal Activation
    if (!currentUser.isCardPaid) {
        throw new AppError('Membership card payment not verified. Activation denied.', 403);
    }

    const user = await prisma.user.update({
        where: { id },
        data: { 
            status: 'ACTIVE',
            authenticatedAt: new Date(),
            authenticatedById: actor.id,
            deletionRequested: false
        }
    });

    await logAudit(actor.id, 'ACTIVATE', 'USER', id, { name: user.name });
    await prisma.notification.create({
        data: {
            userId: id,
            title: '✅ Account Activated',
            message: 'Your membership card has been verified. Welcome to ChurchHub Command.'
        }
    });

    await invalidateCache('users:*');
    res.json({ message: 'User activated successfully.', user });
});

/**
 * 💳 Verify Membership Card Payment
 */
export const markCardAsPaid = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { isPaid } = req.body;
    const actor = req.user!;

    const user = await prisma.user.update({
        where: { id },
        data: { isCardPaid: isPaid }
    });

    await logAudit(actor.id, isPaid ? 'CARD_PAYMENT_VERIFIED' : 'CARD_PAYMENT_REVERSED', 'USER', id, { name: user.name });
    res.json({ message: `Membership card payment status updated for ${user.name}.`, user });
});
// Watua Technical Retrieval
/**
 * 🕵️ Watua Technical Retrieval (Deep Inspection)
 */
export const getUsersTechnical = catchAsync(async (req: AuthRequest, res: Response) => {
    const { page = '1', limit = '50', search = '' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = { deletedAt: null };
    if (search) {
        where.OR = [
            { name: { contains: String(search), mode: 'insensitive' } },
            { membershipNumber: { contains: String(search), mode: 'insensitive' } },
            { idNumber: { contains: String(search), mode: 'insensitive' } },
        ];
    }

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
                department: { select: { name: true } },
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
});

/**
 * 📊 Aggregate System Metrics
 */
export const getSystemStats = catchAsync(async (req: AuthRequest, res: Response) => {
    const stats = await getOrSetCache('system:stats', async () => {
        const [userCount, pendingCount, leaderCount, projectCount, eventCount, deptCount] = await Promise.all([
            prisma.user.count({ where: { deletedAt: null } }),
            prisma.user.count({ where: { status: 'PENDING', deletedAt: null } }),
            prisma.user.count({ where: { role: 'DEPARTMENT_LEADER', deletedAt: null } }),
            prisma.project.count({ where: { deletedAt: null } }),
            prisma.event.count({ where: { deletedAt: null } }),
            prisma.department.count({ where: { deletedAt: null } })
        ]);

        return {
            users: { total: userCount, pending: pendingCount, leaders: leaderCount },
            operations: { projects: projectCount, events: eventCount, departments: deptCount },
            health: 'OPTIMAL',
            kernelVersion: '2.4.0-CHURCHHUB'
        };
    }, 60);

    res.json(stats);
});

/**
 * 🧬 Technical Bio Modification
 */
export const updateUserBioTechnical = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, idNumber, dob, gender } = req.body;
    const actor = req.user!;

    const currentUser = await prisma.user.findUnique({ where: { id } });
    if (!currentUser) throw new AppError('User not found', 404);

    const updateData: any = {
        ...(name && { name }),
        ...(idNumber && { idNumber }),
        ...(dob && { dob: new Date(dob) }),
        ...(gender && { gender })
    };

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

    const updated = await prisma.user.update({
        where: { id },
        data: updateData
    });

    await logAction({
        actorId: actor.id,
        actorRole: actor.role,
        actionType: 'TECHNICAL_REPAIR',
        entityType: 'USER_BIO',
        entityId: id,
        beforeState: currentUser,
        afterState: updated,
        ipAddress: req.ip
    });
    
    res.json(updated);
});

/**
 * 🏥 System Diagnostics & Kernel Health
 */
export const getSystemDiagnostics = catchAsync(async (req: AuthRequest, res: Response) => {
    const logs = await prisma.auditLog.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { name: true } } }
    });

    res.json({
        status: 'HEALTHY',
        uptime: Math.floor(process.uptime()),
        recentLogs: logs,
        lastIntervention: logs[0]?.createdAt || null
    });
});

/**
 * 📂 Audit Log Stream
 */
export const getAuditLogsTechnical = catchAsync(async (req: AuthRequest, res: Response) => {
    const logs = await prisma.auditLog.findMany({
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100
    });
    res.json(logs);
});

/**
 * 🗑️ Trash Hub Management
 */
export const getTrashHub = catchAsync(async (req: AuthRequest, res: Response) => {
    const trash = await RecoveryService.getTrashBin();
    res.json(trash);
});

/**
 * 🐣 Resource Restoration
 */
export const restoreEntity = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { type } = req.body;
    await RecoveryService.restore(type, id, req.user!.id);
    res.json({ message: 'Resource successfully restored to system kernel.' });
});

/**
 * 🚩 Feature Flag Control
 */
export const getFeatureFlags = catchAsync(async (req: AuthRequest, res: Response) => {
    const flags = await prisma.featureFlag.findMany();
    res.json(flags);
});

export const updateFeatureFlag = catchAsync(async (req: AuthRequest, res: Response) => {
    const { name, enabled, scope } = req.body;
    const flag = await prisma.featureFlag.update({
        where: { name },
        data: { enabled, scope }
    });
    await invalidateCache('system:feature_flags');
    res.json(flag);
});

/**
 * 🧬 Execute Sensitive System Intervention
 */
export const executeIntervention = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { action, departmentId } = req.body;
    const actor = req.user!;

    let updateData: any = {};
    const auditAction = `INTERVENTION_${action}`;

    switch (action) {
        case 'ACTIVATE': updateData = { status: 'ACTIVE' }; break;
        case 'PROMOTE_LEADER':
            if (!['WATUA', 'SUPER_ADMIN'].includes(actor.role)) throw new AppError('Bishop/Engineer only.', 403);
            if (!departmentId) throw new AppError('Department required.', 400);
            updateData = { role: 'DEPARTMENT_LEADER', departmentId };
            break;
        case 'DEMOTE_MEMBER':
            if (!['WATUA', 'SUPER_ADMIN'].includes(actor.role)) throw new AppError('Bishop/Engineer only.', 403);
            updateData = { role: 'MEMBER', departmentId: null };
            break;
        case 'MAKE_SUPER_ADMIN':
            if (actor.role !== 'WATUA') throw new AppError('Engineer only.', 403);
            updateData = { role: 'SUPER_ADMIN', departmentId: null };
            break;
        case 'MAKE_SYSTEM_ADMIN':
        case 'MAKE_PASTOR':
        case 'MAKE_ASSOCIATE_PASTOR':
        case 'MAKE_SECRETARY':
            if (!['WATUA', 'SUPER_ADMIN'].includes(actor.role)) throw new AppError('Bishop/Engineer only.', 403);
            {
                const roleMap: any = {
                    'MAKE_SYSTEM_ADMIN': 'SYSTEM_ADMIN',
                    'MAKE_PASTOR': 'PASTOR',
                    'MAKE_ASSOCIATE_PASTOR': 'ASSOCIATE_PASTOR',
                    'MAKE_SECRETARY': 'SECRETARY'
                };
                updateData = { role: roleMap[action], departmentId: null };
            }
            break;
        case 'SUSPEND': updateData = { isSuspended: true }; break;
        case 'UNSUSPEND': updateData = { isSuspended: false }; break;
        case 'RESET_STRIKES': updateData = { wrongdoingCount: 0 }; break;
        default: throw new AppError('Invalid intervention code.', 400);
    }

    const [current, user] = await prisma.$transaction([
        prisma.user.findUnique({ where: { id } }),
        prisma.user.update({ where: { id }, data: updateData })
    ]);

    await logAction({
        actorId: actor.id,
        actorRole: actor.role,
        actionType: auditAction,
        entityType: 'USER',
        entityId: id,
        beforeState: current,
        afterState: user,
        metadata: { intervention: action, sector: departmentId || 'GLOBAL' },
        ipAddress: req.ip
    });

    res.json({ message: `Intervention ${action} successfully committed to database kernel.` });
});

/**
 * 🤝 Enroll in Covenant Partnership
 */
export const enrollPartnership = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id: userId } = req.user!;
    const { amount } = req.body;

    if (!amount || amount < 700) {
        throw new AppError('Partnership enrollment requires a minimum seed of 700 KES.', 400);
    }

    const [partnership, user] = await prisma.$transaction(async (tx) => {
        const p = await tx.partnership.create({
            data: {
                userId,
                amount,
                balance: amount,
                paidAmount: 0,
                frequency: 'MONTHLY',
                status: 'ACTIVE'
            }
        });

        await tx.partnershipLedger.create({
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
        actorRole: req.user!.role,
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
});

/**
 * 🃏 Member Card Renewal Request (3-Week Window Check)
 */
export const requestCardRenewal = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id: userId } = req.user!;
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);

    // 🛑 3-Week Window Check (21 days)
    const { eligible, daysRemaining } = isEligibleForRenewal(user.membershipExpiry);
    if (!eligible) {
        throw new AppError(`Your current card is still valid. You may request renewal 3 weeks before expiry (in ${daysRemaining - 21} days).`, 403);
    }

    const updated = await prisma.user.update({
        where: { id: userId },
        data: { 
            isCardReplacementRequested: true,
            cardStatus: 'PENDING_RENEWAL'
        }
    });

    await logAction({
        actorId: userId,
        actorRole: req.user!.role,
        actionType: 'REQUEST_CARD_RENEWAL',
        entityType: 'USER',
        entityId: userId,
        metadata: { currentExpiry: user.membershipExpiry, daysRemaining },
        ipAddress: req.ip
    });

    res.json({ message: 'Membership card renewal requested. Please wait for administrative verification.', user: updated });
});

/**
 * 🏛️ Admin Approval of Card Renewal (Prioritized Number Generation)
 */
export const approveCardRenewal = catchAsync(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    let { newMembershipNumber } = req.body;

    const userToRenew = await prisma.user.findUnique({ where: { id } });
    if (!userToRenew) throw new AppError('User not found', 404);

    // Automate number generation for currentYear+1
    const targetYear = new Date().getFullYear() + 1;
    if (!newMembershipNumber) {
        newMembershipNumber = await generateNextMembershipNumber(userToRenew.role, targetYear);
    }

    const expiryDate = new Date(targetYear, 11, 31, 23, 59, 59); // Dec 31st of target year

    const [current, updated] = await prisma.$transaction([
        prisma.user.findUnique({ where: { id } }),
        prisma.user.update({
            where: { id },
            data: {
                membershipNumber: newMembershipNumber,
                membershipExpiry: expiryDate,
                cardStatus: 'ACTIVE',
                isCardReplacementRequested: false,
                isCardPaid: true,
                membershipNumberUpdatedAt: new Date()
            }
        })
    ]);

    await logAction({
        actorId: req.user!.id,
        actorRole: req.user!.role,
        actionType: 'APPROVE_CARD_RENEWAL',
        entityType: 'USER',
        entityId: id,
        beforeState: current,
        afterState: updated,
        metadata: { newExpiry: expiryDate, year: targetYear, method: req.body.newMembershipNumber ? 'MANUAL' : 'AUTO' },
        ipAddress: req.ip
    });

    await prisma.notification.create({
        data: {
            userId: id,
            title: '💳 Membership Card Renewed',
            message: `Your card has been renewed for ${targetYear}. New ID: ${newMembershipNumber}`
        }
    });

    res.json({ message: `Membership card renewed for ${updated.name}. New Number: ${newMembershipNumber}`, user: updated });
});

async function auditRenewalRequest(userId: string, role: string, ip: string) {
    try {
        await logAction({
            actorId: userId,
            actorRole: role,
            actionType: 'REQUEST_CARD_RENEWAL',
            entityType: 'USER',
            entityId: userId,
            ipAddress: ip
        });
    } catch (e) {
        console.error('Failed to log renewal request audit.', e);
    }
}

/**
 * 🔍 Efficient Real-time User Search
 */
export const searchUsers = catchAsync(async (req: AuthRequest, res: Response) => {
    const { query, excludeMembers } = req.query;
    if (!query) return res.json([]);

    const users = await prisma.user.findMany({
        where: {
            name: { contains: String(query), mode: "insensitive" },
            status: "ACTIVE",
            deletedAt: null,
            ...(excludeMembers === "true" && { role: { not: "MEMBER" } })
        },
        take: 10,
        select: {
            id: true,
            name: true,
            role: true,
            avatarUrl: true
        }
    });

    res.json(users);
});
