import { db, LocalRole, LocalPermission } from './db';
import { DeviceService } from './DeviceService';
import api from './api-client';

/**
 * 🔒 Local-First Permission Engine (Dynamic Cloud Sync Mode)
 * Synchronizes roles and permissions from the backend and caches them locally
 * in the browser's Dexie database to enable 100% offline security evaluation.
 */

// 🛰️ Baseline Permission Definitions (Mirrored from KERNEL permissions.ts)
// These constants are maintained for type-safety and code-level permission checks.
export const PERMISSIONS = {
    VIEW_GLOBAL_STATS: 'VIEW_GLOBAL_STATS',
    VIEW_FINANCIALS: 'VIEW_FINANCIALS',
    MANAGE_DEPARTMENTS: 'MANAGE_DEPARTMENTS',
    ACCESS_WATUA: 'ACCESS_WATUA',
    MANAGE_USERS: 'MANAGE_USERS',
    VIEW_PERSONNEL: 'VIEW_PERSONNEL',
    SUSPEND_USERS: 'SUSPEND_USERS',
    DELETE_USERS: 'DELETE_USERS',
    PROMOTE_ROLES: 'PROMOTE_ROLES',
    APPROVE_BAPTISM: 'APPROVE_BAPTISM',
    APPROVE_DEDICATION: 'APPROVE_DEDICATION',
    VERIFY_RITE_PAYMENTS: 'VERIFY_RITE_PAYMENTS',
    MANAGE_APPOINTMENTS: 'MANAGE_APPOINTMENTS',
    VIEW_PASTORAL_PORTAL: 'VIEW_PASTORAL_PORTAL',
    VIEW_DEPARTMENT: 'VIEW_DEPARTMENT',
    MANAGE_DEPARTMENT_PROJECTS: 'MANAGE_DEPARTMENT_PROJECTS',
    MANAGE_DEPARTMENT_EVENTS: 'MANAGE_DEPARTMENT_EVENTS',
    MANAGE_DEPARTMENT_PLANS: 'MANAGE_DEPARTMENT_PLANS',
    CREATE_ANNOUNCEMENTS_LOCAL: 'CREATE_ANNOUNCEMENTS_LOCAL',
    CREATE_ANNOUNCEMENTS_GLOBAL: 'CREATE_ANNOUNCEMENTS_GLOBAL',
    MANAGE_PARTNERSHIPS: 'MANAGE_PARTNERSHIPS',
    MANAGE_SUPPORT_REQUESTS: 'MANAGE_SUPPORT_REQUESTS',
    MANAGE_PERMISSIONS: 'MANAGE_PERMISSIONS',
    VIEW_SYSTEM_LOGS: 'VIEW_SYSTEM_LOGS',
} as const;

export type PermissionCode = keyof typeof PERMISSIONS;

// ─── UTILS ──────────────────────────────────────────────────────────────────
const uuidFallback = () => {
    try {
        return crypto.randomUUID();
    } catch {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
};

export const PermissionService = {
    /**
     * Synchronizes the local permission matrix with the backend "Source of Truth".
     * Gracefully falls back to cached Dexie data if offline.
     */
    async syncWithCloud() {
        console.log('🔄 Permission Engine: Synchronizing with Cloud Kernel...');
        try {
            // 1. Fetch live data from backend
            const [rolesResponse, permissionsResponse] = await Promise.all([
                api.get('/permissions/roles'),
                api.get('/permissions')
            ]);

            const remoteRoles = rolesResponse.data;
            const remotePermissions = permissionsResponse.data;
            const deviceId = await DeviceService.getDeviceId();

            // 2. Atomic refresh of local Dexie tables
            await db.transaction('rw', [db.roles, db.permissions, db.rolePermissions], async () => {
                await db.roles.clear();
                await db.permissions.clear();
                await db.rolePermissions.clear();

                // Save Permissions
                for (const perm of remotePermissions) {
                    await db.permissions.add({
                        id: perm.id,
                        code: perm.code,
                        description: perm.description || `Capability to ${perm.code?.toLowerCase().replace(/_/g, ' ')}`,
                        module: perm.module || 'SYSTEM',
                        version: perm.version || 1,
                        deviceId: perm.deviceId || deviceId,
                        syncStatus: 'SYNCED'
                    });
                }

                // Save Roles and Mapping
                for (const role of remoteRoles) {
                    await db.roles.add({
                        id: role.id,
                        name: role.name,
                        description: role.description || `The ${role.name} security group`,
                        version: role.version || 1,
                        deviceId: role.deviceId || deviceId,
                        syncStatus: 'SYNCED'
                    });

                    // Link permissions from mapping
                    if (role.permissions) {
                        for (const rp of role.permissions) {
                            await db.rolePermissions.add({
                                id: rp.id || uuidFallback(),
                                roleId: role.id,
                                permissionId: rp.permissionId,
                                version: 1,
                                deviceId,
                                syncStatus: 'SYNCED'
                            });
                        }
                    }
                }
            });

            console.log('✅ Permission Engine: Cloud synchronization successful.');
            return true;
        } catch (err) {
            console.warn('⚠️ Permission Engine: Synchronization failed (Offline Mode). Using local cache.', err);
            return false;
        }
    },

    /**
     * Updates the permission matrix for a specific role.
     * Pushes to backend and updates local Dexie cache.
     */
    async updateRolePermissions(roleId: string, permissionIds: string[]) {
        const deviceId = await DeviceService.getDeviceId();
        
        try {
            // 1. Push to Cloud (If online)
            await api.put(`/permissions/roles/${roleId}/permissions`, { permissionIds });

            // 2. Update local Dexie immediately to keep UI reactive
            await db.transaction('rw', db.rolePermissions, async () => {
                await db.rolePermissions.where('roleId').equals(roleId).delete();
                for (const pId of permissionIds) {
                    await db.rolePermissions.add({
                        id: uuidFallback(),
                        roleId,
                        permissionId: pId,
                        version: 1,
                        deviceId,
                        syncStatus: 'SYNCED'
                    });
                }
            });
        } catch (err) {
            console.error('❌ Failed to update permissions in cloud:', err);
            // In a full offline-first implementation, we would queue this in syncQueue
            // But for WATUA orchestration, we might prefer immediate feedback.
            throw err;
        }
    },

    /**
     * Fetches the complete permission matrix locally.
     */
    /**
     * Fetches the complete permission matrix locally.
     */
    async getMatrix() {
        const roles = await db.roles.toArray();
        const permissions = await db.permissions.toArray();
        const mapping = await db.rolePermissions.toArray();

        // Hydrate roles with their permissions
        const hydratedRoles = roles.map(role => ({
            ...role,
            permissions: mapping
                .filter(m => m.roleId === role.id)
                .map(m => ({ 
                    permissionId: m.permissionId, 
                    permission: permissions.find(p => p.id === m.permissionId) 
                }))
        }));

        return { roles: hydratedRoles, allPermissions: permissions };
    },
    async hasPermission(roleName: string, permissionCode: string): Promise<boolean> {
        // OMNIPOTENT ROLES
        if (['WATUA', 'SUPER_ADMIN'].includes(roleName)) return true;

        const role = await db.roles.where('name').equals(roleName).first();
        if (!role) return false;

        const permission = await db.permissions.where('code').equals(permissionCode).first();
        if (!permission) return false;

        const mapping = await db.rolePermissions
            .where('roleId').equals(role.id)
            .and(m => m.permissionId === permission.id)
            .first();

        return !!mapping;
    },

    /**
     * Enforces the permission engine. Throws a Kernel-level error if the role is unauthorized.
     */
    async enforce(roleName: string, permissionCode: string): Promise<void> {
        const authorized = await this.hasPermission(roleName, permissionCode);
        if (!authorized) {
            throw new Error(`[Security Violation] Role '${roleName}' lacks the required capability: ${permissionCode}`);
        }
    }
};
