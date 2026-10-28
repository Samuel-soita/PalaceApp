import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

let findUnique: () => Promise<unknown> = async () => null;

vi.mock('../utils/prisma.js', () => ({
    default: { user: { findUnique: () => findUnique() } },
}));
vi.mock('../utils/redis.js', () => ({
    getOrSetCache: (_key: string, fetchFn: () => Promise<unknown>) => fetchFn(),
}));

const { authenticate } = await import('../middleware/auth.middleware.js');
const { refreshSession } = await import('../modules/auth/auth.controller.js');

const SECRET = process.env.JWT_SECRET || 'secret';
const member = { id: 'u1', role: 'MEMBER', departmentId: 'd1', status: 'ACTIVE', isSuspended: false, managedDepartments: [] };

function mockRes() {
    const res: any = { statusCode: 200, body: undefined };
    res.status = (code: number) => { res.statusCode = code; return res; };
    res.json = (body: unknown) => { res.body = body; return res; };
    return res;
}

async function runAuth(token: string) {
    const req: any = { headers: { authorization: `Bearer ${token}` }, path: '/test' };
    const res = mockRes();
    const next = vi.fn();
    await authenticate(req, res, next);
    return { req, res, next };
}

describe('session persistence', () => {
    beforeEach(() => { findUnique = async () => null; });

    it('accepts a valid token', async () => {
        findUnique = async () => member;
        const { next } = await runAuth(jwt.sign({ id: 'u1', role: 'MEMBER' }, SECRET));
        expect(next).toHaveBeenCalled();
    });

    it('answers 401 for an invalid token', async () => {
        const { res, next } = await runAuth(jwt.sign({ id: 'u1', role: 'MEMBER' }, 'wrong-secret'));
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('answers 503, not 401, when the database is unreachable', async () => {
        findUnique = async () => { throw new Error("P1001: Can't reach database server"); };
        const { res, next } = await runAuth(jwt.sign({ id: 'u1', role: 'MEMBER' }, SECRET));
        expect(res.statusCode).toBe(503);
        expect(next).not.toHaveBeenCalled();
    });

    it('refresh issues a 90-day token with the current role and department', async () => {
        findUnique = async () => ({ id: 'u1', role: 'MEMBER', departmentId: 'd2' });
        const res = mockRes();
        await refreshSession({ headers: {}, user: { id: 'u1', role: 'MEMBER', departmentId: 'd1' } }, res);
        const claims = jwt.verify(res.body.token, SECRET) as jwt.JwtPayload;
        expect(claims).toMatchObject({ id: 'u1', role: 'MEMBER', departmentId: 'd2' });
        expect(claims.exp! - claims.iat!).toBe(90 * 24 * 60 * 60);
    });

    it('refresh answers 503 when the database is unreachable', async () => {
        findUnique = async () => { throw new Error('timeout'); };
        const res = mockRes();
        await refreshSession({ headers: {}, user: { id: 'u1' } }, res);
        expect(res.statusCode).toBe(503);
    });
});
