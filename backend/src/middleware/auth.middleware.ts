import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma.js';
import { getOrSetCache } from '../utils/redis.js';
import { AppError } from '../utils/errors.js';
import { pastorHasModule } from '../utils/pastor-module-keys.js';

const EXPIRED_LOG_COOLDOWN_MS = 60_000;
let lastExpiredTokenLogAt = 0;
export type Role = 'SUPER_ADMIN' | 'SYSTEM_ADMIN' | 'SECRETARY' | 'DEPARTMENT_LEADER' | 'MEMBER' | 'PASTOR' | 'ASSOCIATE_PASTOR' | 'WATUA';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        role: Role;
        departmentId?: string | null;
        managedDepartments?: { id: string }[];
        status?: string;
        isSuspended?: boolean;
        canManagePartnerships?: boolean;
        pastorModules?: string[];
    };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        console.warn(`[AUTH_FAILURE] Missing Token for request to ${req.path}`);
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
        
        // --- SECURITY UPGRADE: STRICT ROUTE LOCKDOWN ---
        // 1. Session Binding & Validation via Redis 
        const sessionKey = `auth:session:${decoded.id}`;
        const user = await getOrSetCache(sessionKey, async () => {
             return await prisma.user.findUnique({ 
                where: { id: decoded.id },
                include: { managedDepartments: { select: { id: true } } } 
            });
        }, 15); // Drop cache to 15 SECONDS to force near real-time re-checks!

        if (!user) {
            console.warn(`[AUTH_FAILURE] Session invalidated or user missing for ID ${decoded.id} on path ${req.path}`);
            return res.status(401).json({ error: 'Session invalidated. User profile missing.' });
        }

        // 2. Role Re-check on Every Load
        // If a Bishop demoted a user 10 seconds ago, their JWT still says 'DEPARTMENT_LEADER'.
        // We MUST re-check the live DB role to prevent escalation attacks.
        if (user.role !== decoded.role) {
            console.error('Role mismatch 403', { userRole: user.role, decodedRole: decoded.role });
            return res.status(403).json({ error: 'SECURITY ALERT: Role mismatch detected. Your permissions have changed. Please log in again.' });
        }

        if (user.isSuspended || user.status === 'SUSPENDED') {
            console.error('Suspended 403', { isSuspended: user.isSuspended, status: user.status });
            return res.status(403).json({ error: 'Account suspended. Contact Bishop.' });
        }

        
        let pastorModules: string[] = [];
        if (user.role === 'PASTOR' || user.role === 'ASSOCIATE_PASTOR') {
            const mods = await (prisma as any).pastorModuleAccess.findMany({
                where: { pastorId: user.id },
                select: { moduleKey: true }
            });
            pastorModules = mods.map((m: any) => m.moduleKey);
        }

        req.user = {
            ...decoded,
            managedDepartments: (user as any).managedDepartments || [],
            canManagePartnerships: (user as any).canManagePartnerships || false,
            pastorModules
        };
        next();
    } catch (error: any) {
        const isExpired = error.name === 'TokenExpiredError' || error.message === 'jwt expired';
        if (isExpired && Date.now() - lastExpiredTokenLogAt < EXPIRED_LOG_COOLDOWN_MS) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        if (isExpired) lastExpiredTokenLogAt = Date.now();
        console.warn(`[AUTH_FAILURE] Invalid or expired token for path ${req.path}. Error: ${error.message}`);
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};

export const authorize = (roles: Role[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }
        
        if (!roles.includes(req.user.role)) {
            console.error(`[RBAC_VIOLATION] User ${req.user.id} (${req.user.role}) attempted restricted access to ${req.path}`);
            throw new AppError(`Access denied: Required roles [${roles.join(', ')}]`, 403);
        }
        next();
    };
};

export const departmentGuard = (req: AuthRequest, res: Response, next: NextFunction) => {
    const { departmentId } = req.params;

    if (!req.user) throw new AppError('Authentication required', 401);

    // Global access roles
    if (['SUPER_ADMIN', 'WATUA', 'SYSTEM_ADMIN', 'SECRETARY'].includes(req.user.role)) {
        return next();
    }

    // Leaders and Pastors check managed departments mapped to them
    if (['DEPARTMENT_LEADER', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(req.user.role)) {
        const isManaging = req.user.managedDepartments?.some(d => d.id === departmentId);
        if (isManaging || req.user.departmentId === departmentId) {
            return next();
        }
    }

    throw new AppError('Access denied: You do not manage this department.', 403);
};

/**
 * 👨‍⚖️ MODULE-LEVEL SCOPING GUARD - v2.4.0
 * Ensures Pastors only access modules assigned to them.
 */
export const moduleGuard = (moduleKey: string) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) throw new AppError('Authentication required', 401);

        // Bypassing Roles (Full Authority)
        if (['SUPER_ADMIN', 'WATUA', 'SYSTEM_ADMIN', 'SECRETARY'].includes(req.user.role)) {
            return next();
        }

        // Pastor Scoping Logic
        if (req.user.role === 'PASTOR' || req.user.role === 'ASSOCIATE_PASTOR') {
            if (pastorHasModule(req.user.pastorModules, moduleKey)) {
                return next();
            }
            throw new AppError(`SECURITY ALERT: You do not have the '${moduleKey}' module assigned. Contact Bishop.`, 403);
        }

        // Non-Pastors (Members/Leaders) - Fallback to role-based access
        next();
    };
};

