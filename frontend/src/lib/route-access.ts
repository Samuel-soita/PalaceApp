/**
 * Single source of truth for which roles may open which routes.
 * Used by the route guards in App.tsx and by the navigation, so the menu never
 * shows a link that the guard would bounce.
 */
export const ROUTE_ROLES = {
    bishop: ['SUPER_ADMIN'],
    executive: ['SYSTEM_ADMIN', 'SECRETARY', 'SUPER_ADMIN', 'WATUA', 'DEPARTMENT_LEADER'],
    pastor: ['PASTOR', 'ASSOCIATE_PASTOR', 'SUPER_ADMIN', 'WATUA'],
    content: ['PASTOR', 'ASSOCIATE_PASTOR', 'SUPER_ADMIN', 'WATUA', 'SYSTEM_ADMIN', 'SECRETARY', 'DEPARTMENT_LEADER'],
    watua: ['WATUA'],
    health: ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'WATUA'],
} as const;

const PATH_RULES: { prefix: string; roles: readonly string[] }[] = [
    { prefix: '/bishop', roles: ROUTE_ROLES.bishop },
    { prefix: '/departments', roles: ROUTE_ROLES.bishop },
    { prefix: '/executive', roles: ROUTE_ROLES.executive },
    { prefix: '/support', roles: ROUTE_ROLES.executive },
    { prefix: '/health', roles: ROUTE_ROLES.health },
    { prefix: '/watua', roles: ROUTE_ROLES.watua },
    { prefix: '/pastor', roles: ROUTE_ROLES.pastor },
    { prefix: '/announcements', roles: ROUTE_ROLES.content },
    { prefix: '/calendar', roles: ROUTE_ROLES.content },
    { prefix: '/projects', roles: ROUTE_ROLES.content },
];

export function hasRole(role: string | undefined, allowed: readonly string[]): boolean {
    return !!role && allowed.includes(role);
}

export function canAccessPath(role: string | undefined, href: string): boolean {
    if (href === '/messages') return !!role && role !== 'MEMBER';
    const rule = PATH_RULES.find(r => href === r.prefix || href.startsWith(`${r.prefix}/`));
    return rule ? hasRole(role, rule.roles) : !!role;
}

/** The dashboard a role lands on from "/". Keep in sync with RootRedirect in App.tsx. */
export function homePathFor(role: string | undefined, departmentId?: string | null): string {
    switch (role) {
        case 'SUPER_ADMIN': return '/bishop';
        case 'WATUA': return '/watua';
        case 'SYSTEM_ADMIN':
        case 'SECRETARY': return '/executive';
        case 'PASTOR':
        case 'ASSOCIATE_PASTOR': return '/pastor';
        case 'DEPARTMENT_LEADER': return departmentId ? `/department/${departmentId}` : '/executive';
        default: return '/';
    }
}
