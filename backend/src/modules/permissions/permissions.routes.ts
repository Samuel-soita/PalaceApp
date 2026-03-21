import { Router } from 'express';
import { prisma } from '../../utils/prisma.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/permissions.middleware.js';
import { PERMISSIONS } from '../../utils/permissions.js';
import { seedPermissions } from '../../utils/seed-permissions.js';

const router = Router();

// Apply authentication to all permission routes
router.use(authenticate);

// ─── UTILITY: Audit Log Helper ──────────────────────────────────────────────
async function logPermissionAudit(wauserId: string, action: string, details: string) {
    await prisma.auditLog.create({
        data: {
            actorId: wauserId,
            actionType: action,
            entityType: 'PERMISSION_ENGINE',
            metadata: { details },
            actorRole: 'SYSTEM_ADMIN'
        }
    });
}

// ─── PUBLIC(ISH): Get All Permission Codes ──────────────────────────────────
router.get('/', authorize(PERMISSIONS.MANAGE_PERMISSIONS), async (req, res) => {
    try {
        const permissions = await prisma.permission.findMany({
            include: { roles: { include: { role: true } } }
        });
        res.json(permissions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch permissions' });
    }
});

// ─── ROLES & PERMISSIONS MATRIX ─────────────────────────────────────────────
router.get('/roles', authorize(PERMISSIONS.MANAGE_PERMISSIONS), async (req, res) => {
    try {
        const roles = await prisma.role.findMany({
            include: { permissions: { include: { permission: true } } }
        });
        res.json(roles);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch roles' });
    }
});

router.put('/roles/:roleId/permissions', authorize(PERMISSIONS.MANAGE_PERMISSIONS), async (req, res) => {
    const { roleId } = req.params;
    const { permissionIds } = req.body; // Array of Permission IDs
    const waUser = (req as any).user;

    try {
        // Atomic update: delete old, create new
        const uniquePermissionIds = [...new Set(permissionIds as string[])];

        await prisma.$transaction([
            prisma.rolePermission.deleteMany({ where: { roleId } }),
            prisma.rolePermission.createMany({
                data: uniquePermissionIds.map((pId: string) => ({
                    roleId,
                    permissionId: pId
                }))
            })
        ]);

        await logPermissionAudit(waUser.id, 'UPDATE_ROLE_PERMISSIONS', `Updated permissions for Role ID: ${roleId}`);
        res.json({ message: 'Permissions updated successfully' });
    } catch (error) {
        console.error('[Permissions Update Error]', error);
        res.status(500).json({ 
            error: 'Failed to update role permissions', 
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

// ─── PERMISSION OVERRIDES ───────────────────────────────────────────────────
router.post('/overrides', authorize(PERMISSIONS.MANAGE_PERMISSIONS), async (req, res) => {
    const { userId, permissionId, granted, expiresAt, reason } = req.body;
    const waUser = (req as any).user;

    try {
        const override = await prisma.permissionOverride.upsert({
            where: { userId_permissionId: { userId, permissionId } },
            update: { granted, expiresAt: new Date(expiresAt), reason, creatorId: waUser.id },
            create: { userId, permissionId, granted, expiresAt: new Date(expiresAt), reason, creatorId: waUser.id }
        });

        await logPermissionAudit(waUser.id, 'SET_OVERRIDE', `Set override for User: ${userId}, Permission: ${permissionId}, Granted: ${granted}`);
        res.json(override);
    } catch (error) {
        res.status(500).json({ error: 'Failed to set permission override' });
    }
});

router.post('/re-seed', authorize(PERMISSIONS.MANAGE_PERMISSIONS), async (req, res) => {
    try {
        await seedPermissions();
        const waUser = (req as any).user;
        await logPermissionAudit(waUser.id, 'RE_SEED_PERMISSION_ENGINE', 'System permissions were forcefully re-synchronized with codebase definitions.');
        res.json({ message: 'Permission Engine successfully re-synchronized with KERNEL definitions.' });
    } catch (error) {
        console.error('[Permission Re-Seed Error]', error);
        res.status(500).json({ error: 'Failed to re-sync permission engine' });
    }
});

router.get('/audit-log', authorize(PERMISSIONS.MANAGE_PERMISSIONS), async (req, res) => {
    try {
        const logs = await prisma.auditLog.findMany({
            where: { entityType: 'PERMISSION_ENGINE' },
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: { actor: { select: { name: true, role: true } } }
        });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

export default router;
