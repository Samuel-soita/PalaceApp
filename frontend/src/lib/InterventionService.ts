import { db } from './db';
import OfflineQueue from './offline-queue';
import { AuditLogService } from './AuditLogService';
import { PermissionService } from './PermissionService';
import { DeviceService } from './DeviceService';
import { PERMISSIONS } from './PermissionService';

/**
 * 🛠️ Frontend Intervention Service
 * Mirror of the backend technical kernel.
 * Executes administrative commands directly against the local Dexie store.
 */

export type InterventionAction = 
    | 'ACTIVATE' 
    | 'PROMOTE_LEADER' 
    | 'DEMOTE_MEMBER' 
    | 'MAKE_SUPER_ADMIN' 
    | 'MAKE_SYSTEM_ADMIN' 
    | 'MAKE_PASTOR' 
    | 'MAKE_ASSOCIATE_PASTOR' 
    | 'MAKE_SECRETARY' 
    | 'MAKE_WATUA'
    | 'SUSPEND' 
    | 'UNSUSPEND' 
    | 'RESET_STRIKES';

export const InterventionService = {
    /**
     * Executes a system-level intervention on a user record locally.
     * Queues the action for background sync if a network becomes available.
     */
    async execute(userId: string, action: InterventionAction, actorRole: string, departmentId?: string) {
        const deviceId = await DeviceService.getDeviceId();
        const savedUser = localStorage.getItem('user');
        const actor = savedUser ? JSON.parse(savedUser) : null;
        const actorId = actor?.id || 'SYSTEM';

        // 🛡️ 1. Dynamic Security Enforcement
        const permissionRequired = (action.startsWith('MAKE_') || action === 'PROMOTE_LEADER' || action === 'DEMOTE_MEMBER') 
            ? PERMISSIONS.PROMOTE_ROLES 
            : action === 'RESET_STRIKES' 
                ? PERMISSIONS.MANAGE_USERS 
                : PERMISSIONS.SUSPEND_USERS;

        await PermissionService.enforce(actorRole, permissionRequired);

        // 2. Fetch current record to handle versioning
        const currentUser = await db.users.get(userId);
        if (!currentUser) throw new Error('Target user record not found in local kernel.');

        const updateData: any = { 
            updatedAt: new Date().toISOString(),
            version: (currentUser.version || 0) + 1,
            deviceId,
            lastModifiedBy: actorId
        };

        switch (action) {
            case 'ACTIVATE': 
                updateData.status = 'ACTIVE'; 
                break;
            case 'PROMOTE_LEADER':
                if (!departmentId) throw new Error('Operational sector (department) selection required for leadership promotion.');
                updateData.role = 'DEPARTMENT_LEADER';
                updateData.departmentId = departmentId;
                break;
            case 'DEMOTE_MEMBER':
                updateData.role = 'MEMBER';
                updateData.departmentId = null;
                break;
            case 'MAKE_SUPER_ADMIN':
                if (actorRole !== 'WATUA') throw new Error('System Engineer (WATUA) authorization required for Bishop promotion.');
                updateData.role = 'SUPER_ADMIN';
                updateData.departmentId = null;
                break;
            case 'MAKE_WATUA':
                if (actorRole !== 'WATUA' && actorRole !== 'SUPER_ADMIN') throw new Error('Authorization required for System Engineer promotion.');
                updateData.role = 'WATUA';
                updateData.departmentId = null;
                updateData.status = 'ACTIVE';
                break;
            case 'MAKE_SYSTEM_ADMIN':
            case 'MAKE_PASTOR':
            case 'MAKE_ASSOCIATE_PASTOR':
            case 'MAKE_SECRETARY':
                {
                    const roleMap: Record<string, string> = {
                        'MAKE_SYSTEM_ADMIN': 'SYSTEM_ADMIN',
                        'MAKE_PASTOR': 'PASTOR',
                        'MAKE_ASSOCIATE_PASTOR': 'ASSOCIATE_PASTOR',
                        'MAKE_SECRETARY': 'SECRETARY'
                    };
                    updateData.role = roleMap[action];
                    updateData.departmentId = departmentId || null;
                }
                break;
            case 'SUSPEND': 
                updateData.isSuspended = true; 
                updateData.lastSuspendedAt = new Date().toISOString();
                break;
            case 'UNSUSPEND': 
                updateData.isSuspended = false; 
                break;
            case 'RESET_STRIKES': 
                updateData.wrongdoingCount = 0; 
                break;
            default: 
                throw new Error('Invalid administrative intervention code.');
        }

        // 3. Commit to Local Kernel (Dexie)
        await db.users.update(userId, { ...updateData, syncStatus: 'PENDING' });

        // 4. Record Administrative Audit Trail
        await AuditLogService.log(action, 'USER', userId, {
            previousRole: currentUser.role,
            newRole: updateData.role || currentUser.role,
            departmentId
        });

        // 5. Queue for External Sync
        await OfflineQueue.dispatch(
            `/users/technical/intervention/${userId}`, 
            'POST', 
            { ...updateData, action },
            'HIGH'
        );

        return { success: true, action, userId };
    },

    /**
     * Handle "Force-Approval" of complex workflows.
     */
    async forceApproval(resourceType: string, id: string) {
        const deviceId = await DeviceService.getDeviceId();
        const savedUser = localStorage.getItem('user');
        const actor = savedUser ? JSON.parse(savedUser) : null;
        const actorId = actor?.id || 'SYSTEM';
        const actorRole = actor?.role || 'MEMBER';

        // 🛡️ Security Check
        const permissionMap: Record<string, string> = {
            'PROJECT': PERMISSIONS.MANAGE_DEPARTMENT_PROJECTS,
            'EVENT': PERMISSIONS.MANAGE_DEPARTMENT_EVENTS,
            'PLAN': PERMISSIONS.MANAGE_DEPARTMENT_PLANS,
            'ANNOUNCEMENT': PERMISSIONS.CREATE_ANNOUNCEMENTS_GLOBAL,
            'BAPTISM': PERMISSIONS.APPROVE_BAPTISM,
            'C_DEDICATION': PERMISSIONS.APPROVE_DEDICATION,
            'REPAIR': PERMISSIONS.VIEW_FINANCIALS
        };

        await PermissionService.enforce(actorRole, permissionMap[resourceType] || PERMISSIONS.ACCESS_WATUA);

        let table: any;
        let url = '';
        let statusField = 'status';
        const statusValue = 'APPROVED';

        switch (resourceType) {
            case 'PROJECT':
                table = db.projects;
                statusField = 'approvalStatus';
                url = `/projects/${id}/status`;
                break;
            case 'EVENT':
                table = db.events;
                statusField = 'approvalStatus';
                url = `/events/${id}/status`;
                break;
            case 'PLAN':
                table = db.plans;
                statusField = 'approvalStatus';
                url = `/plans/${id}/status`;
                break;
            case 'ANNOUNCEMENT':
                table = db.announcements;
                url = `/announcements/${id}/status`;
                break;
            case 'REPAIR':
                table = db.repairs;
                url = `/repairs/${id}/approve`;
                break;
            case 'BAPTISM':
                table = db.baptisms;
                url = `/workflows/baptism/${id}/status`;
                break;
            case 'C_DEDICATION':
                table = db.children;
                statusField = 'workflowStatus';
                url = `/workflows/dedication/${id}/status`;
                break;
            default:
                throw new Error('Unknown Resource Type for Force-Approval');
        }

        if (table) {
            const current = await table.get(id);
            const updateData = { 
                [statusField]: statusValue,
                syncStatus: 'PENDING', 
                updatedAt: new Date().toISOString(),
                version: (current?.version || 0) + 1,
                deviceId,
                lastModifiedBy: actorId
            };

            await table.update(id, updateData);
            await AuditLogService.log(`FORCE_APPROVE_${resourceType}`, resourceType, id);
            await OfflineQueue.dispatch(url, 'PATCH', updateData, 'HIGH');
        }
    }
};
