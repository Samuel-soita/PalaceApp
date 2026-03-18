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
    
    // Spiritual & Pastoral
    APPROVE_BAPTISM: 'APPROVE_BAPTISM',
    APPROVE_DEDICATION: 'APPROVE_DEDICATION',
    MANAGE_APPOINTMENTS: 'MANAGE_APPOINTMENTS',
    VIEW_PASTORAL_PORTAL: 'VIEW_PASTORAL_PORTAL',
    
    // Operational & Departmental
    VIEW_DEPARTMENT: 'VIEW_DEPARTMENT',
    MANAGE_DEPARTMENT_PROJECTS: 'MANAGE_DEPARTMENT_PROJECTS',
    MANAGE_DEPARTMENT_EVENTS: 'MANAGE_DEPARTMENT_EVENTS',
    MANAGE_DEPARTMENT_PLANS: 'MANAGE_DEPARTMENT_PLANS',
    CREATE_ANNOUNCEMENTS: 'CREATE_ANNOUNCEMENTS',
    
    // Support & Partnerships
    MANAGE_PARTNERSHIPS: 'MANAGE_PARTNERSHIPS',
    MANAGE_SUPPORT_REQUESTS: 'MANAGE_SUPPORT_REQUESTS',
    
    // System Technical
    MANAGE_PERMISSIONS: 'MANAGE_PERMISSIONS',
    VIEW_SYSTEM_LOGS: 'VIEW_SYSTEM_LOGS',
} as const;

export type PermissionCode = keyof typeof PERMISSIONS;

export interface PermissionContext {
    departmentId?: string;
}

/**
 * Checks if a user has a specific permission based on their role and overrides.
 * Note: This utility is for shared logic. The actual check usually happens 
 * after the user and their permissions/overrides are fetched from the DB.
 */
export function evaluateAccess(
    userPermissions: string[],
    permissionCode: string,
    overrides: { permissionCode: string, granted: boolean }[] = [],
    context?: PermissionContext
): boolean {
    // 1. Check for explicit overrides (Highest Priority)
    const override = overrides.find(o => o.permissionCode === permissionCode);
    if (override) return override.granted;

    // 2. Check Role permissions
    return userPermissions.includes(permissionCode);
}
