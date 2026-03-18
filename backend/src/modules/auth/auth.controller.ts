import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';

import { findTargetDepartmentId } from '../../utils/department-mapper.js';

/**
 * POST /auth/register
 * Required: name, idNumber, membershipNumber, dob, gender
 * Optional: password — if omitted, defaults to membershipNumber
 */
export const register = async (req: Request, res: Response) => {
    const { name, idNumber, membershipNumber, dob, gender, phoneNumber } = req.body;

    // --- Validation ---
    if (!name || !idNumber || !membershipNumber || !dob || !gender || !phoneNumber) {
        return res.status(400).json({
            error: 'All fields are required: Full Name, ID Number, Membership Card, Date of Birth, Gender, Phone Number.'
        });
    }

        // --- Card Format Validation: XXX/XXX/YYYY ---
    const cardPattern = /^\d{3}\/\d{3}\/(\d{4})$/;
    const cardMatch = membershipNumber.match(cardPattern);
    if (!cardMatch) {
        return res.status(400).json({
            error: 'Invalid Membership Card format. Expected: 063/001/2026 (member/branch/year).'
        });
    }
    const cardYear = parseInt(cardMatch[1], 10);
    const currentYear = new Date().getFullYear();
    if (cardYear < currentYear) {
        return res.status(400).json({
            error: `Card year ${cardYear} is expired. Please provide a card for ${currentYear} or later.`
        });
    }

    try {
        // --- Uniqueness checks (descriptive errors) ---
        const [existingId, existingCard] = await Promise.all([
            prisma.user.findUnique({ where: { idNumber } }),
            prisma.user.findUnique({ where: { membershipNumber } })
        ]);

        if (existingId) {
            return res.status(409).json({ error: 'This ID Number is already registered in the system.' });
        }
        if (existingCard) {
            return res.status(409).json({ error: 'This Membership Card Number is already registered.' });
        }

        // --- Auto Department Mapping ---
        const targetDepartmentId = await findTargetDepartmentId(new Date(dob), gender);

        const user = await prisma.user.create({
            data: {
                name,
                idNumber,
                membershipNumber,
                phoneNumber,
                dob: new Date(dob),
                gender: gender.toUpperCase(),
                role: 'MEMBER',
                status: 'PENDING',
                ...(targetDepartmentId ? { departmentId: targetDepartmentId } : {})
            },
        });

        res.status(201).json({
            message: `Registration successful! Your account is awaiting verification.`,
            departmentId: targetDepartmentId
        });
    } catch (error: any) {
        console.error('[Register Error]', error);
        res.status(400).json({ error: error.message || 'Registration failed. Please try again.' });
    }
};

export const login = async (req: Request, res: Response) => {
    const { membershipNumber } = req.body;

    try {
        if (!membershipNumber) {
            return res.status(400).json({ error: 'Membership Card Number is required.' });
        }

        // --- card format validation: XXX/XXX/YYYY ---
        const cardPattern = /^\d{3}\/\d{3}\/(\d{4})$/;
        if (!membershipNumber.match(cardPattern)) {
            return res.status(400).json({ 
                error: 'Invalid Membership Card format. Expected: 063/001/2026' 
            });
        }

        const user = await prisma.user.findUnique({ 
            where: { membershipNumber },
            include: { 
                managedDepartments: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } }
            }
        });

        console.log('[Login] User query result:', user ? 'Found' : 'Not found');

        if (!user) {
            return res.status(401).json({ error: 'No account found with this Membership Card Number.' });
        }

        if (user.status !== 'ACTIVE' && user.role !== 'WATUA') {
            return res.status(403).json({
                error: `Account ${user.status.toLowerCase()}. Please contact the Secretary or Bishop for verification.`,
                status: user.status
            });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, departmentId: user.departmentId },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '30d' } // Persistent login
        );

        // --- 4. Fetch Permissions & Overrides ---
        const rolePermissions = await prisma.rolePermission.findMany({
            where: { role: { name: user.role } },
            include: { permission: true }
        });

        const overrides = await prisma.permissionOverride.findMany({
            where: { 
                userId: user.id,
                expiresAt: { gt: new Date() }
            },
            include: { permission: true }
        });

        // Flatten permissions with overrides applied
        const basePerms = rolePermissions.map((rp: any) => rp.permission.code);
        const overrideGrants = overrides.filter((o: any) => o.granted).map((o: any) => o.permission.code);
        const overrideRevokes = overrides.filter((o: any) => !o.granted).map((o: any) => o.permission.code);

        const finalPermissions = [...new Set([...basePerms, ...overrideGrants])]
            .filter(code => !overrideRevokes.includes(code));

        res.json({
            user: { 
                id: user.id, 
                name: user.name, 
                role: user.role, 
                avatarUrl: user.avatarUrl, 
                status: user.status, 
                departmentId: user.departmentId,
                managedDepartments: user.managedDepartments,
                permissions: finalPermissions
            },
            token
        });
    } catch (error: any) {
        console.error('[CRITICAL] Login Error Stack:', error.stack || error);
        res.status(500).json({ 
            error: 'Login failed. Please try again.',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const getProfile = async (req: any, res: Response) => {
    try {
        const user = await prisma.user.findUnique({ 
            where: { id: req.user.id },
            include: { 
                managedDepartments: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } }
            }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });
        // --- Fetch Permissions & Overrides ---
        const rolePermissions = await prisma.rolePermission.findMany({
            where: { role: { name: user.role } },
            include: { permission: true }
        });

        const overrides = await prisma.permissionOverride.findMany({
            where: { 
                userId: user.id,
                expiresAt: { gt: new Date() }
            },
            include: { permission: true }
        });

        const basePerms = rolePermissions.map((rp: any) => rp.permission.code);
        const overrideGrants = overrides.filter((o: any) => o.granted).map((o: any) => o.permission.code);
        const overrideRevokes = overrides.filter((o: any) => !o.granted).map((o: any) => o.permission.code);

        const finalPermissions = [...new Set([...basePerms, ...overrideGrants])]
            .filter(code => !overrideRevokes.includes(code));

        res.json({
            ...user,
            permissions: finalPermissions
        });
    } catch (error) {
        console.error('Get Profile Error:', error);
        res.status(500).json({ error: 'Failed to fetch profile', details: (error as any).message });
    }
};

export const updateProfile = async (req: any, res: Response) => {
    try {
        const { name, avatarUrl, gender, dob, membershipNumber, phoneNumber, deletionRequested } = req.body;
        const userId = req.user.id;

        const currentUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!currentUser) return res.status(404).json({ error: 'User not found' });

        const updateData: any = {};
        if (name) updateData.name = name;
        if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
        if (gender) updateData.gender = gender;
        if (dob) updateData.dob = new Date(dob);
        if (phoneNumber) updateData.phoneNumber = phoneNumber;
        
        // Members cannot delete accounts directly, they can only flag it for Watua/Bishop.
        if (deletionRequested === true) {
            updateData.deletionRequested = true;
            await logAudit(userId, 'ACCOUNT_DELETION_REQUESTED', 'USER', userId, { ip: req.ip });
        }

        // --- Membership Card: Format + Year-based Lock ---
        if (membershipNumber && membershipNumber !== currentUser.membershipNumber) {
            // Validate format: XXX/XXX/YYYY
            const cardPattern = /^\d{3}\/\d{3}\/(\d{4})$/;
            const match = membershipNumber.match(cardPattern);
            if (!match) {
                return res.status(400).json({
                    error: 'Invalid Membership Card format. Expected format: 063/001/2026 (member/branch/year).'
                });
            }

            const cardYear = parseInt(match[1], 10);
            const currentYear = new Date().getFullYear();

            // Current card year: lock renewal unless old card is expired
            const existingCard = currentUser.membershipNumber as string | null;
            if (existingCard) {
                const existingMatch = existingCard.match(/^\d{3}\/\d{3}\/(\d{4})$/);
                if (existingMatch) {
                    const existingYear = parseInt(existingMatch[1], 10);
                    if (existingYear >= currentYear && cardYear <= existingYear) {
                        return res.status(403).json({
                            error: `Your current card (${existingCard}) is valid through ${existingYear}. You may renew it in ${existingYear + 1}.`,
                            renewalYear: existingYear + 1
                        });
                    }
                }
            }

            // Check uniqueness
            const existing = await prisma.user.findUnique({ where: { membershipNumber } });
            if (existing && existing.id !== userId) {
                return res.status(409).json({ error: 'This Membership Card Number is already in use.' });
            }

            updateData.membershipNumber = membershipNumber;
            updateData.membershipNumberUpdatedAt = new Date();
        }

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
            where: { id: userId },
            data: updateData
        });

        res.json(updated);
    } catch (error: any) {
        console.error('[Update Profile Error]', error);
        res.status(500).json({ error: 'Failed to update profile.' });
    }
};

/**
 * POST /auth/watua-access
 * No credentials required. Triggered by the hidden keyboard sequence.
 * Issues a WATUA-scoped JWT automatically.
 */
export const watuaAccess = async (req: Request, res: Response) => {
    try {
        console.log('[WatuaAccess] Triggered');
        const engineer = await prisma.user.findFirst({
            where: { role: 'WATUA', status: 'ACTIVE' }
        });

        if (!engineer) {
            console.log('[WatuaAccess] Engineer not found');
            return res.status(503).json({ error: 'System intervention module unavailable.' });
        }

        console.log('[WatuaAccess] Engineer found:', engineer.id);

        try {
            await logAudit(engineer.id, 'WATUA_LOGIN', 'SYSTEM', 'KEYLESS_TRIGGER', {
                ip: req.ip || 'unknown',
                timestamp: new Date().toISOString()
            });
            console.log('[WatuaAccess] Audit logged');
        } catch (auditErr) {
            console.error('[WatuaAccess] Audit Error (non-blocking):', auditErr);
        }

        const token = jwt.sign(
            { id: engineer.id, role: 'WATUA', departmentId: null },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '30d' }
        );
        console.log('[WatuaAccess] Token signed');

        res.json({ user: engineer, token });
        console.log('[WatuaAccess] Success response sent');
    } catch (error: any) {
        console.error('[Watua Access Error]', error);
        if (error instanceof Error) {
            console.error(error.stack);
        }
        res.status(500).json({ 
            error: 'System intervention access failed.', 
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
export const authenticateUser = async (req: any, res: Response) => {
    const { userId } = req.body;
    const admin = req.user;

    // RBAC: Only SUPER_ADMIN, SYSTEM_ADMIN, SECRETARY, or WATUA can authenticate.
    if (!['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'WATUA'].includes(admin.role)) {
        return res.status(403).json({ error: 'Unauthorized: You do not have permission to authenticate users.' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'User not found.' });

        if (user.status === 'ACTIVE') {
            return res.status(400).json({ error: 'User is already active.' });
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                status: 'ACTIVE',
                authenticatedAt: new Date(),
                authenticatedById: admin.id
            }
        });

        await logAudit(admin.id, 'AUTHENTICATE', 'USER', userId, { name: user.name });

        res.json({ message: `User ${user.name} has been authenticated successfully.`, user: updatedUser });
    } catch (error: any) {
        console.error('[Authenticate User Error]', error);
        res.status(500).json({ error: 'Failed to authenticate user.' });
    }
};
