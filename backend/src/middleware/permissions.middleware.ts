import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma.js';
import { evaluateAccess } from '../utils/permissions.js';

/**
 * Middleware to authorize a request based on a specific permission code.
 * It checks the user's role permissions and any active overrides.
 */
export const authorize = (permissionCode: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;

        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        try {
            // 1. Fetch user's role-based permissions
            const rolePermissions = await prisma.rolePermission.findMany({
                where: { role: { name: user.role } },
                include: { permission: true }
            });

            const userPermissionCodes = rolePermissions.map((rp: any) => rp.permission.code);

            // 2. Fetch user's active overrides
            const overrides = await prisma.permissionOverride.findMany({
                where: { 
                    userId: user.id,
                    expiresAt: {
                        gt: new Date() // Only active overrides
                    }
                },
                include: { permission: true }
            });

            const mappedOverrides = overrides.map((o: any) => ({
                permissionCode: o.permission.code,
                granted: o.granted
            }));

            // 3. Evaluate access
            const hasAccess = evaluateAccess(userPermissionCodes, permissionCode, mappedOverrides);

            if (hasAccess) {
                return next();
            }

            return res.status(403).json({ 
                error: 'Forbidden: Insufficient permissions',
                requiredPermission: permissionCode 
            });

        } catch (error) {
            console.error('Authorization Error:', error);
            return res.status(500).json({ error: 'Internal server error during authorization' });
        }
    };
};
