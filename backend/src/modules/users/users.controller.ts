import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';
import { findTargetDepartmentId } from '../../utils/department-mapper.js';

export const getUsers = async (req: Request, res: Response) => {
    try {
        const { role } = req.query;
        const whereClause = role ? { role: String(role) } : {};
        
        const users = await prisma.user.findMany({
            where: whereClause,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                departmentId: true,
                status: true,
                membershipNumber: true
            }
        });
        
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const getPendingUsers = async (req: any, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            where: { status: 'PENDING' },
            select: {
                id: true,
                name: true,
                email: true,
                membershipNumber: true,
                role: true,
                createdAt: true,
                avatarUrl: true
            }
        });
        res.json(users);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch pending users' });
    }
};

export const activateUser = async (req: any, res: Response) => {
    const { id } = req.params;
    const { status } = req.body; // ACTIVE or REJECTED

    try {
        if (status === 'REJECTED') {
            const user = await prisma.user.delete({ where: { id } });
            await logAudit(req.user.id, 'REJECT', 'USER', id, { name: user.name });
            return res.json({ message: 'User registration rejected and purged.' });
        }

        const user = await prisma.user.update({
            where: { id },
            data: { status: 'ACTIVE' }
        });

        await logAudit(req.user.id, 'ACTIVATE', 'USER', id, { name: user.name });

        await prisma.notification.create({
            data: {
                userId: id,
                title: '✅ Account Activated',
                message: 'Your membership card has been verified. Welcome to ChurchHub Command.'
            }
        });

        res.json({ message: 'User activated successfully.', user });
    } catch (error: any) {
        res.status(400).json({ error: 'Failed to update user status' });
    }
};
// Watua Technical Retrieval
export const getUsersTechnical = async (req: any, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                status: true,
                isSuspended: true,
                membershipNumber: true,
                wrongdoingCount: true,
                // Biographical fields for Support
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
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to access entity register' });
    }
};

export const getSystemStats = async (req: any, res: Response) => {
    try {
        const [userCount, pendingCount, leaderCount, projectCount, eventCount, deptCount] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { status: 'PENDING' } }),
            prisma.user.count({ where: { role: 'DEPARTMENT_LEADER' } }),
            prisma.project.count(),
            prisma.event.count(),
            prisma.department.count()
        ]);

        res.json({
            users: { total: userCount, pending: pendingCount, leaders: leaderCount },
            operations: { projects: projectCount, events: eventCount, departments: deptCount },
            health: 'OPTIMAL',
            kernelVersion: '2.4.0-CHURCHHUB'
        });
    } catch (error) {
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

        const updated = await prisma.user.update({
            where: { id },
            data: updateData
        });

        await logAudit(req.user.id, 'TECHNICAL_REPAIR', 'USER_BIO', id, { name, idNumber, dob, gender });
        res.json(updated);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to execute bio repair' });
    }
};

export const getSystemDiagnostics = async (req: any, res: Response) => {
    try {
        const logs = await prisma.auditLog.findMany({
            take: 20,
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { name: true } } }
        });

        // Mocking failure analysis - in a real app, this would query a dedicated error log table
        res.json({
            status: 'HEALTHY',
            uptime: Math.floor(process.uptime()),
            recentLogs: logs,
            lastIntervention: logs[0]?.createdAt || null
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to access diagnostics' });
    }
};

export const getAuditLogsTechnical = async (req: any, res: Response) => {
    try {
        const logs = await prisma.auditLog.findMany({
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to access intervention records' });
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
                if (req.user.role !== 'WATUA') return res.status(403).json({ error: 'Only System Engineer can appoint leaders.' });
                if (!departmentId) return res.status(400).json({ error: 'Department selection is mandatory for leadership appointments.' });
                updateData = { role: 'DEPARTMENT_LEADER', departmentId };
                break;
            case 'DEMOTE_MEMBER':
                if (req.user.role !== 'WATUA') return res.status(403).json({ error: 'Only System Engineer can demote leaders.' });
                updateData = { role: 'MEMBER', departmentId: null };
                break;
            case 'MAKE_SUPER_ADMIN':
                if (req.user.role !== 'WATUA') return res.status(403).json({ error: 'Only System Engineer can appoint Super Admins.' });
                updateData = { role: 'SUPER_ADMIN', departmentId: null };
                break;
            case 'MAKE_SYSTEM_ADMIN':
                if (req.user.role !== 'WATUA') return res.status(403).json({ error: 'Only System Engineer can appoint Church Administrators.' });
                updateData = { role: 'SYSTEM_ADMIN', departmentId: null };
                break;
            case 'MAKE_SECRETARY':
                if (req.user.role !== 'WATUA') return res.status(403).json({ error: 'Only System Engineer can appoint Secretaries.' });
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
            default:
                return res.status(400).json({ error: 'Invalid intervention code' });
        }

        const user = await prisma.user.update({
            where: { id },
            data: updateData
        });

        await logAudit(req.user.id, auditAction, 'USER', id, { 
            actor: req.user.role,
            target: user.email,
            intervention: action,
            sector: departmentId || 'GLOBAL'
        });

        res.json({ message: `Intervention ${action} successfully committed to database kernel.` });
    } catch (error) {
        res.status(500).json({ error: 'Database kernel rejected intervention.' });
    }
};
