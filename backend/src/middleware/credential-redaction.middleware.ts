import { Request, Response, NextFunction } from 'express';

/**
 * Membership number + national ID number are the login credentials. Many queries include
 * full User rows, so this strips `idNumber` from every JSON response unless the record is
 * the requester's own or the requester administers member identities.
 */
const IDENTITY_ADMIN_ROLES = new Set(['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY']);
const MAX_DEPTH = 12;

function redact(value: any, ownId: string | undefined, depth: number, seen: WeakSet<object>): any {
    if (value === null || typeof value !== 'object' || depth > MAX_DEPTH) return value;
    if (value instanceof Date || seen.has(value)) return value;
    seen.add(value);

    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) value[i] = redact(value[i], ownId, depth + 1, seen);
        return value;
    }

    let out = value;
    if ('idNumber' in value && value.id !== ownId) {
        const { idNumber: _omit, ...rest } = value;
        out = rest;
    }
    for (const key of Object.keys(out)) {
        const child = out[key];
        if (child !== null && typeof child === 'object') out[key] = redact(child, ownId, depth + 1, seen);
    }
    return out;
}

export function credentialRedaction(req: Request, res: Response, next: NextFunction) {
    const originalJson = res.json.bind(res);
    res.json = (body?: any) => {
        const user = (req as any).user;
        if (user && IDENTITY_ADMIN_ROLES.has(user.role)) return originalJson(body);
        return originalJson(redact(body, user?.id, 0, new WeakSet()));
    };
    next();
}
