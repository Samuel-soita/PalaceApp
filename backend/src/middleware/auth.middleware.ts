import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma.js';
import { getOrSetCache } from '../utils/redis.js';
export type Role = 'SUPER_ADMIN' | 'SYSTEM_ADMIN' | 'SECRETARY' | 'DEPARTMENT_LEADER' | 'MEMBER' | 'PASTOR' | 'WATUA';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        role: Role;
        departmentId?: string | null;
        managedDepartments?: { id: string }[];
        status?: string;
        isSuspended?: boolean;
    };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
        
        // --- SECURITY UPGRADE: STRICT ROUTE LOCKDOWN ---
        // 1. Session Binding & Validation via Redis 
        const sessionKey = `auth:session:${decoded.id}`;
        let user = await getOrSetCache(sessionKey, async () => {
             return await prisma.user.findUnique({ 
                where: { id: decoded.id },
                include: { managedDepartments: { select: { id: true } } } 
            });
        }, 15); // Drop cache to 15 SECONDS to force near real-time re-checks!

        if (!user) {
            return res.status(401).json({ error: 'Session invalidated. User profile missing.' });
        }

        // 2. Role Re-check on Every Load
        // If a Bishop demoted a user 10 seconds ago, their JWT still says 'DEPARTMENT_LEADER'.
        // We MUST re-check the live DB role to prevent escalation attacks.
        if (user.role !== decoded.role) {
            return res.status(403).json({ error: 'SECURITY ALERT: Role mismatch detected. Your permissions have changed. Please log in again.' });
        }

        if (user.isSuspended || user.status === 'SUSPENDED') {
            return res.status(403).json({ error: 'Account suspended. Contact Bishop.' });
        }

        
        req.user = {
            ...decoded,
            managedDepartments: user.managedDepartments || []
        };
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};

export const authorize = (roles: Role[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        next();
    };
};

export const departmentGuard = (req: AuthRequest, res: Response, next: NextFunction) => {
    const { departmentId } = req.params;

    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    // Global access roles
    if (['SUPER_ADMIN', 'WATUA', 'SYSTEM_ADMIN', 'SECRETARY'].includes(req.user.role)) {
        return next();
    }

    // Leaders and Pastors check managed departments mapped to them
    if (['DEPARTMENT_LEADER', 'PASTOR'].includes(req.user.role)) {
        const isManaging = req.user.managedDepartments?.some(d => d.id === departmentId);
        // Fallback for primary departmentId just in case
        if (isManaging || req.user.departmentId === departmentId) {
            return next();
        }
    }

    res.status(403).json({ error: 'Access denied to this department' });
};
