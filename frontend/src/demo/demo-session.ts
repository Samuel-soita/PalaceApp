/**
 * Demo mode runs the whole app against an in-browser backend with sample data.
 * A demo session is marked by a `demo: true` claim in an unsigned token, so it ends
 * with the normal logout and the real server would reject the token anyway.
 */
export const DEMO_STORE_KEY = 'palace-demo-store';

export type DemoRole = 'MEMBER' | 'DEPARTMENT_LEADER' | 'PASTOR' | 'SUPER_ADMIN' | 'SECRETARY' | 'WATUA';

export interface DemoPersona {
    role: DemoRole;
    userId: string;
    label: string;
    description: string;
}

export const DEMO_PERSONAS: DemoPersona[] = [
    { role: 'MEMBER', userId: 'demo-member', label: 'Member', description: 'Daily devotion, events, appointments and child registration.' },
    { role: 'DEPARTMENT_LEADER', userId: 'demo-leader', label: 'Department Leader', description: 'Run a department: events, projects, plans, finances and reports.' },
    { role: 'PASTOR', userId: 'demo-pastor', label: 'Pastor', description: 'Approve submissions, publish devotions, baptisms and dedications.' },
    { role: 'SUPER_ADMIN', userId: 'demo-bishop', label: 'Bishop', description: 'Church-wide overview, final approvals and pastor modules.' },
    { role: 'SECRETARY', userId: 'demo-secretary', label: 'Secretary', description: 'Verify members, appointments and church-wide broadcasts.' },
    { role: 'WATUA', userId: 'demo-watua', label: 'System Engineer', description: 'Registry, permissions, recovery and system health.' },
];

let cachedToken: string | null = null;
let cachedIsDemo = false;

function decodeClaims(token: string): Record<string, unknown> | null {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch {
        return null;
    }
}

export function isDemoSession(): boolean {
    const token = localStorage.getItem('token');
    if (token !== cachedToken) {
        cachedToken = token;
        cachedIsDemo = !!token && decodeClaims(token)?.demo === true;
    }
    return cachedIsDemo;
}

export function createDemoToken(userId: string, role: string): string {
    const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '');
    const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
    return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ id: userId, role, demo: true, exp })}.demo`;
}
