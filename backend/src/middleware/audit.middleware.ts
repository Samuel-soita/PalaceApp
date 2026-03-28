import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma.js';

/**
 * Audit Middleware: The Immutable Mission Clerk.
 * Intercepts all state-changing missions (POST, PUT, DELETE, PATCH)
 * and records them into the AuditLog for high-command oversight.
 */
export const auditLogger = async (req: Request, res: Response, next: NextFunction) => {
    // 1. Only track state-changing actions
    const trackedMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!trackedMethods.includes(req.method)) {
        return next();
    }

    // 2. Identify the Actor
    const user = (req as any).user;
    if (!user) {
        return next(); // Skip if not authenticated (e.g., login attempt)
    }

    // Capture the original 'send' to intercept the response
    const originalSend = res.send;

    res.send = function (body) {
        // Run audit logging after the response is sent to avoid blocking the user
        const statusCode = res.statusCode;
        
        // Only log successful or 4xx/5xx operations if they were intended as state changes
        if (statusCode >= 200 && statusCode < 300) {
            const entityType = req.path.split('/')[1]?.toUpperCase() || 'SYSTEM';
            const actionType = `${req.method}_${entityType}`;
            
            // Extract entityId if possible (usually the last part of the path if it's a UUID)
            const parts = req.path.split('/');
            const entityId = parts.length > 2 && parts[2].length > 20 ? parts[2] : null;

            prisma.auditLog.create({
                data: {
                    entityType,
                    actionType,
                    entityId,
                    actorId: user.id,
                    actorRole: user.role,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                    metadata: {
                        path: req.path,
                        params: req.params,
                        query: req.query,
                        // We avoid logging sensitive body data like passwords
                        hasBody: !!req.body
                    }
                }
            }).catch(err => console.error('[AUDIT_FAILURE]', err));
        }

        return originalSend.call(this, body);
    };

    next();
};
