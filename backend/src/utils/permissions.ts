export const PERMISSIONS = {
    // Executive Command
    VIEW_GLOBAL_STATS: 'VIEW_GLOBAL_STATS',
    VIEW_FINANCIALS: 'VIEW_FINANCIALS',
    MANAGE_DEPARTMENTS: 'MANAGE_DEPARTMENTS',
    ACCESS_WATUA: 'ACCESS_WATUA',
    
    // User & Personnel Management
    MANAGE_USERS: 'MANAGE_USERS',
    VIEW_PERSONNEL: 'VIEW_PERSONNEL',
    SUSPEND_USERS: 'SUSPEND_USERS',
    DELETE_USERS: 'DELETE_USERS',
    PROMOTE_ROLES: 'PROMOTE_ROLES',
    
    // Spiritual & Pastoral
    APPROVE_BAPTISM: 'APPROVE_BAPTISM',
    APPROVE_DEDICATION: 'APPROVE_DEDICATION',
    VERIFY_RITE_PAYMENTS: 'VERIFY_RITE_PAYMENTS',
    MANAGE_APPOINTMENTS: 'MANAGE_APPOINTMENTS',
    VIEW_PASTORAL_PORTAL: 'VIEW_PASTORAL_PORTAL',
    
    // Operational & Departmental
    VIEW_DEPARTMENT: 'VIEW_DEPARTMENT',
    MANAGE_DEPARTMENT_PROJECTS: 'MANAGE_DEPARTMENT_PROJECTS',
    MANAGE_DEPARTMENT_EVENTS: 'MANAGE_DEPARTMENT_EVENTS',
    MANAGE_DEPARTMENT_PLANS: 'MANAGE_DEPARTMENT_PLANS',
    CREATE_ANNOUNCEMENTS_LOCAL: 'CREATE_ANNOUNCEMENTS_LOCAL',
    CREATE_ANNOUNCEMENTS_GLOBAL: 'CREATE_ANNOUNCEMENTS_GLOBAL',
    
    // Support & Partnerships
    MANAGE_PARTNERSHIPS: 'MANAGE_PARTNERSHIPS',
    MANAGE_SUPPORT_REQUESTS: 'MANAGE_SUPPORT_REQUESTS',
    
    // System Technical
    MANAGE_PERMISSIONS: 'MANAGE_PERMISSIONS',
    VIEW_SYSTEM_LOGS: 'VIEW_SYSTEM_LOGS',
} as const;

export type PermissionCode = keyof typeof PERMISSIONS;

export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionCode[]> = {
    MEMBER: [],
    DEPARTMENT_LEADER: ['VIEW_DEPARTMENT', 'MANAGE_DEPARTMENT_PROJECTS', 'MANAGE_DEPARTMENT_EVENTS', 'MANAGE_DEPARTMENT_PLANS', 'CREATE_ANNOUNCEMENTS_LOCAL'],
    PASTOR: ['VIEW_PASTORAL_PORTAL', 'APPROVE_BAPTISM', 'APPROVE_DEDICATION', 'MANAGE_APPOINTMENTS'],
    SECRETARY: ['VIEW_GLOBAL_STATS', 'VIEW_PERSONNEL', 'MANAGE_APPOINTMENTS', 'VERIFY_RITE_PAYMENTS'],
    SYSTEM_ADMIN: ['VIEW_GLOBAL_STATS', 'VIEW_FINANCIALS', 'MANAGE_DEPARTMENTS', 'MANAGE_USERS', 'VIEW_PERSONNEL', 'SUSPEND_USERS', 'CREATE_ANNOUNCEMENTS_GLOBAL', 'VERIFY_RITE_PAYMENTS'],
    SUPER_ADMIN: Object.keys(PERMISSIONS) as PermissionCode[],
    WATUA: Object.keys(PERMISSIONS) as PermissionCode[]
};

export interface PermissionContext {
    departmentId?: string;
}

/**
 * Checks if a user has a specific permission based on their role and overrides.
 * Note: This utility is for shared logic. The actual check usually happens 
 * after the user and their permissions/overrides are fetched from the DB.
 */
export function evaluateAccess(
    userRole: string,
    userPermissions: string[],
    permissionCode: string,
    overrides: { permissionCode: string, granted: boolean }[] = [],
    context?: PermissionContext
): boolean {
    if (userRole === 'WATUA' || userRole === 'SUPER_ADMIN') return true;

    // 1. Check for explicit overrides (Highest Priority)
    const override = overrides.find(o => o.permissionCode === permissionCode);
    if (override) return override.granted;

    // 2. Check Role permissions from DB
    if (userPermissions.includes(permissionCode)) return true;

    // 3. Fallback to Hardcoded Hybrid Defaults
    const defaultPerms = DEFAULT_ROLE_PERMISSIONS[userRole] || [];
    return defaultPerms.includes(permissionCode as PermissionCode);
}

/**
 * Synchronous helper for controllers to check permissions using hybrid logic.
 * Expects the standard Express `req.user` object.
 */
export function hasPermission(user: any, permissionCode: string): boolean {
    if (!user) return false;
    return evaluateAccess(user.role, user.permissions || [], permissionCode, user.overrides || []);
}
