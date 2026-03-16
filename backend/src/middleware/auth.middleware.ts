import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma.js';
export type Role = 'SUPER_ADMIN' | 'SYSTEM_ADMIN' | 'SECRETARY' | 'DEPARTMENT_LEADER' | 'MEMBER' | 'PASTOR' | 'WATUA';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        role: Role;
        departmentId?: string | null;
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
        
        // Final database check for existence and status
        const user = await prisma.user.findUnique({ where: { id: decoded.id } }) as any;
        
        if (!user) {
            return res.status(401).json({ error: 'User session invalid. Please log in again.' });
        }

        if (user.isSuspended || user.status === 'SUSPENDED') {
            return res.status(403).json({ error: 'Account suspended. Contact Bishop.' });
        }

        req.user = decoded;
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

    if (req.user.role === 'SUPER_ADMIN') return next();

    if (req.user.role === 'DEPARTMENT_LEADER' && req.user.departmentId === departmentId) {
        return next();
    }

    res.status(403).json({ error: 'Access denied to this department' });
};
