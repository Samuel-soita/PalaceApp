import { db } from './db';
import OfflineQueue from './offline-queue';
import { AuditLogService } from './AuditLogService';
import { PermissionService } from './PermissionService';
import { DeviceService } from './DeviceService';
import api from './api-client';
import { requestSyncSoon } from './pwa-sync';
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

        if (navigator.onLine) {
            try {
                const res = await api.post(`/users/technical/intervention/${userId}`, { action, departmentId });
                const serverUser = res.data?.user ?? res.data;
                await db.users.update(userId, serverUser?.id ? { ...serverUser, syncStatus: 'SYNCED' } : { ...updateData, syncStatus: 'SYNCED' });
            } catch (err: any) {
                throw new Error(err.response?.data?.error || err.response?.data?.message || 'Intervention rejected by the server.');
            }
            await AuditLogService.log(action, 'USER', userId, {
                previousRole: currentUser.role,
                newRole: updateData.role || currentUser.role,
                departmentId
            });
            requestSyncSoon();
            return { success: true, action, userId };
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
     * Runs against the server first; the local store only reflects what the server accepted.
     */
    async forceApproval(resourceType: string, id: string) {
        const savedUser = localStorage.getItem('user');
        const actor = savedUser ? JSON.parse(savedUser) : null;
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

        if (!navigator.onLine) {
            throw new Error('Force-approval needs a live server connection.');
        }

        let table: any;
        let request: () => Promise<any>;
        let pick: (data: any) => any = (data) => data;

        switch (resourceType) {
            case 'PROJECT':
                table = db.projects;
                request = () => api.patch(`/projects/${id}/status`, { approvalStatus: 'APPROVED' });
                pick = (data) => data?.project;
                break;
            case 'EVENT':
                table = db.events;
                request = () => api.patch(`/events/${id}/status`, { approvalStatus: 'APPROVED' });
                pick = (data) => data?.event;
                break;
            case 'PLAN':
                table = db.plans;
                request = () => api.patch(`/plans/${id}/status`, { approvalStatus: 'APPROVED' });
                pick = (data) => data?.plan;
                break;
            case 'ANNOUNCEMENT':
                table = db.announcements;
                request = () => api.put(`/announcements/${id}`, { status: 'PUBLISHED' });
                break;
            case 'MEETING':
                table = db.meetings;
                request = () => api.patch(`/meetings/${id}`, { meetingStatus: 'SCHEDULED' });
                break;
            case 'BAPTISM': {
                table = db.baptisms;
                const current = await table.get(id);
                const next: Record<string, string> = {
                    PENDING_PASTOR_APPROVAL: 'ADMIN_PAYMENT_VERIFICATION',
                    BISHOP_APPROVED: 'COMPLETED',
                };
                const status = next[current?.status];
                if (!status) throw new Error('Payment verification needs the admin to record the card number and payment reference.');
                request = () => api.patch(`/workflows/baptism/${id}/status`, { status });
                pick = (data) => data?.baptism;
                break;
            }
            case 'C_DEDICATION': {
                table = db.children;
                const current = await table.get(id);
                const next: Record<string, string> = {
                    PENDING_DEDICATION: 'ADMIN_PAYMENT_VERIFICATION',
                    BISHOP_RITE_PENDING: 'DEDICATED',
                };
                const workflowStatus = next[current?.workflowStatus];
                if (!workflowStatus) throw new Error('Payment verification needs the admin to record the card number and payment reference.');
                request = () => api.patch(`/workflows/dedication/${id}/status`, { workflowStatus });
                pick = (data) => data?.child;
                break;
            }
            case 'REPAIR':
                throw new Error('Repairs are approved through the pastor, admin and Bishop signature chain.');
            default:
                throw new Error('Unknown Resource Type for Force-Approval');
        }

        try {
            const res = await request();
            const record = pick(res.data);
            if (record?.id) {
                const existing = await table.get(id);
                await table.put({ ...existing, ...record, syncStatus: 'SYNCED' });
            }
        } catch (err: any) {
            throw new Error(err.response?.data?.error || err.response?.data?.message || `Force-approval of ${resourceType} failed.`);
        }

        await AuditLogService.log(`FORCE_APPROVE_${resourceType}`, resourceType, id);
        requestSyncSoon();
    }
};
