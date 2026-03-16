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
    const { name, idNumber, membershipNumber, dob, gender, password } = req.body;

    // --- Validation ---
    if (!name || !idNumber || !membershipNumber || !dob || !gender) {
        return res.status(400).json({
            error: 'All fields are required: Full Name, ID Number, Membership Card, Date of Birth, Gender.'
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

        // --- Create User ---
        // Use membershipNumber as password if none provided — user logs in with card anyway.
        const rawPassword = password || membershipNumber;
        const hashedPassword = await bcrypt.hash(rawPassword, 10);

        // email is a legacy required field — derive it from membershipNumber
        const email = `${membershipNumber.toLowerCase().replace(/\s/g, '')}@member.prayerpalace.org`;

        const user = await prisma.user.create({
            data: {
                name,
                email,
                idNumber,
                membershipNumber,
                dob: new Date(dob),
                gender: gender.toUpperCase(),
                password: hashedPassword,
                role: 'MEMBER',
                status: 'PENDING',
                ...(targetDepartmentId ? { departmentId: targetDepartmentId } : {})
            } as any,
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

/**
 * POST /auth/login
 * Login using Membership Card Number (+ password for security).
 * The 'watua' secret trigger uses email/password as usual.
 */
export const login = async (req: Request, res: Response) => {
    const { membershipNumber, email, password } = req.body;

    try {
        let user: any = null;

        // WATUA uses a hidden bypass (Email/MasterKey based)
        if (email === 'watua@prayerpalace.org') {
            user = await prisma.user.findUnique({ where: { email } });
        } 
        // Everyone else logs in with membershipNumber
        else if (membershipNumber) {
            user = await prisma.user.findUnique({ where: { membershipNumber } });
        }

        if (!user) {
            return res.status(401).json({ error: 'No account found with those credentials.' });
        }

        // --- Security Check ---
        // Watua login still passes password (the master key) in the hidden buffer
        // OTHERS (Bishop/Leaders/Members) are currently passwordless via Card
        if (user.role === 'WATUA') {
            if (!password || !(await bcrypt.compare(password, user.password))) {
                return res.status(401).json({ error: 'Invalid master key sequence.' });
            }
            await logAudit(user.id, 'WATUA_LOGIN', 'SYSTEM', 'MANAGEMENT_PORTAL', { ip: req.ip });
        } else {
            if (user.status !== 'ACTIVE') {
                return res.status(403).json({
                    error: `Account ${user.status.toLowerCase()}. Please contact Bishop for verification.`,
                    status: user.status
                });
            }
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, departmentId: user.departmentId },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '30d' } // Persistent login
        );

        res.json({
            user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl, status: user.status, departmentId: user.departmentId },
            token
        });
    } catch (error: any) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
};

export const getProfile = async (req: any, res: Response) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) return res.status(404).json({ error: 'User not found' });
        const { password: _, ...safeUser } = user as any;
        res.json(safeUser);
    } catch (error) {
        console.error('Get Profile Error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
};

export const updateProfile = async (req: any, res: Response) => {
    try {
        const { name, avatarUrl, gender, dob, membershipNumber } = req.body;
        const userId = req.user.id;

        const currentUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!currentUser) return res.status(404).json({ error: 'User not found' });

        const updateData: any = {};
        if (name) updateData.name = name;
        if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
        if (gender) updateData.gender = gender;
        if (dob) updateData.dob = new Date(dob);

        // --- Membership Card: Format + Year-based Lock ---
        if (membershipNumber && membershipNumber !== (currentUser as any).membershipNumber) {
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
            const existingCard = (currentUser as any).membershipNumber as string | null;
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

        const { password: _, ...safeUser } = updated as any;
        res.json(safeUser);
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
        const engineer = await prisma.user.findFirst({
            where: { role: 'WATUA', status: 'ACTIVE' }
        });

        if (!engineer) {
            return res.status(503).json({ error: 'System intervention module unavailable.' });
        }

        await logAudit(engineer.id, 'WATUA_LOGIN', 'SYSTEM', 'KEYLESS_TRIGGER', {
            ip: req.ip,
            timestamp: new Date().toISOString()
        });

        const token = jwt.sign(
            { id: engineer.id, role: 'WATUA', departmentId: null },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '30d' } // Persistent login
        );

        const { password: _, ...safeUser } = engineer as any;
        res.json({ user: safeUser, token });
    } catch (error: any) {
        console.error('[Watua Access Error]', error);
        res.status(500).json({ error: 'System intervention access failed.' });
    }
};
