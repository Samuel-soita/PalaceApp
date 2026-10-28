import { Request, Response, NextFunction } from 'express';
import { broadcastSync } from '../utils/socket.js';
import { invalidateLiveCaches } from '../utils/redis.js';

/**
 * Route prefix -> sync modules (names match the client's /sync/:module streams and
 * react-query invalidation). Every successful mutation under a prefix broadcasts
 * these modules so all dashboards re-pull within ~1s instead of waiting for polling.
 */
const PREFIX_MODULES: Record<string, string[]> = {
    events: ['events', 'dashboard'],
    announcements: ['announcements', 'dashboard'],
    plans: ['plans', 'dashboard'],
    projects: ['projects', 'dashboard'],
    meetings: ['meetings', 'dashboard'],
    messages: ['messages'],
    devotions: ['devotions'],
    users: ['members', 'dashboard'],
    children: ['children', 'dashboard'],
    workflows: ['baptisms', 'children', 'dashboard'],
    finance: ['finance', 'dashboard'],
    budgets: ['budgets', 'finance', 'dashboard'],
    repairs: ['repairs', 'dashboard'],
    appointments: ['appointments'],
    partnerships: ['partnerships', 'dashboard'],
    departments: ['departments', 'dashboard'],
    reports: ['reports'],
    support: ['support_requests', 'dashboard'],
    settings: ['settings'],
    permissions: ['permissions'],
    recovery: ['events', 'announcements', 'plans', 'projects', 'meetings', 'members', 'children', 'dashboard'],
};

// Per-user or chat-only data that no cached live list depends on.
const CACHE_NEUTRAL_PREFIXES = new Set(['messages', 'notifications']);

const AUTH_MUTATIONS: Record<string, string[]> = {
    '/auth/register': ['members', 'dashboard'],
    '/auth/profile': ['members'],
};

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function realtimeBroadcast(req: Request, res: Response, next: NextFunction) {
    if (!MUTATING.has(req.method)) return next();

    res.on('finish', () => {
        if (res.statusCode >= 400) return;
        const path = req.originalUrl.split('?')[0];
        const prefix = path.split('/')[1] ?? '';
        if (!CACHE_NEUTRAL_PREFIXES.has(prefix)) invalidateLiveCaches();
        const modules = AUTH_MUTATIONS[path] ?? PREFIX_MODULES[prefix];
        if (modules) broadcastSync(...modules);
    });
    next();
}
