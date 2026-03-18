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
        
        // --- PERFORMANCE: Session Caching ---
        // We cache the active session in Redis to prevent "Too many connections" on high load.
        const sessionKey = `auth:session:${decoded.id}`;
        
        let user = await getOrSetCache(sessionKey, async () => {
             return await prisma.user.findUnique({ 
                where: { id: decoded.id },
                include: { managedDepartments: { select: { id: true } } } 
            });
        }, 300); // 5 minute session cache

        if (!user) {
            return res.status(401).json({ error: 'User session invalid. Please log in again.' });
        }
// ...

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
