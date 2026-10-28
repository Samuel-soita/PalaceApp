import prisma from './prisma.js';
import { logAction } from './audit.service.js';

const TRASH_COLLECTIONS: Record<string, { model: string; select: Record<string, any> }> = {
    USER: { model: 'user', select: { name: true } },
    DEPARTMENT: { model: 'department', select: { name: true } },
    PROJECT: { model: 'project', select: { title: true } },
    EVENT: { model: 'event', select: { title: true } },
    PLAN: { model: 'plan', select: { title: true } },
    ANNOUNCEMENT: { model: 'announcement', select: { title: true } },
    MEETING: { model: 'meeting', select: { title: true } },
    BUDGET: { model: 'budget', select: { title: true } },
    CHILD: { model: 'child', select: { name: true } },
    BAPTISM: { model: 'baptism', select: { user: { select: { name: true } } } },
    PARTNERSHIP: { model: 'partnership', select: { user: { select: { name: true } } } },
};

export class RecoveryService {
    /**
     * Soft-deletes an entity by setting deletedAt and other metadata.
     */
    static async softDelete(
        model: any,
        id: string,
        actorId: string,
        reason: string = 'No reason provided'
    ) {
        const entityType = model.name.toUpperCase();
        
        // Capture state before deletion
        const beforeState = await (prisma as any)[model.name.toLowerCase()].findUnique({ where: { id } });
        if (!beforeState) throw new Error(`${entityType} not found.`);

        const updated = await (prisma as any)[model.name.toLowerCase()].update({
            where: { id },
            data: {
                deletedAt: new Date(),
                deletedBy: actorId,
                deletedReason: reason,
                version: { increment: 1 }
            }
        });

        await logAction({
            actorId,
            actionType: 'SOFT_DELETE',
            entityType,
            entityId: id,
            beforeState,
            afterState: updated,
            metadata: { reason }
        });

        return updated;
    }

    /**
     * Restores a soft-deleted entity.
     */
    static async restore(
        modelName: string,
        id: string,
        actorId: string
    ) {
        const entityType = modelName.toUpperCase();
        const modelKey = TRASH_COLLECTIONS[entityType]?.model;
        if (!modelKey) throw new Error(`${entityType} cannot be restored.`);

        const beforeState = await (prisma as any)[modelKey].findUnique({ where: { id } });
        if (!beforeState) throw new Error(`${entityType} not found.`);
        if (!beforeState.deletedAt) throw new Error(`${entityType} is not deleted.`);

        const updated = await (prisma as any)[modelKey].update({
            where: { id },
            data: {
                deletedAt: null,
                deletedBy: null,
                deletedReason: null,
                version: { increment: 1 }
            }
        });

        await logAction({
            actorId,
            actionType: 'RESTORE',
            entityType,
            entityId: id,
            beforeState,
            afterState: updated,
            metadata: { restoredAt: new Date().toISOString() }
        });

        return updated;
    }

    /**
     * Lists all soft-deleted items across major collections.
     * WATUA / SUPER_ADMIN only.
     */
    static async getTrashBin() {
        const results: any[] = [];

        for (const [type, { model, select }] of Object.entries(TRASH_COLLECTIONS)) {
            const items = await (prisma as any)[model].findMany({
                where: { deletedAt: { not: null } },
                select: { id: true, deletedAt: true, deletedBy: true, deletedReason: true, ...select },
                orderBy: { deletedAt: 'desc' },
                take: 200,
            });

            results.push(...items.map((item: any) => ({
                id: item.id,
                deletedAt: item.deletedAt,
                deletedBy: item.deletedBy,
                deletedReason: item.deletedReason,
                type,
                displayName: item.name || item.title || item.user?.name || item.id
            })));
        }

        return results.sort((a, b) => {
            const timeA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
            const timeB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
            return timeB - timeA;
        });
    }
}
