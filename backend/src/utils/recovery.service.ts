import prisma from './prisma.js';
import { logAction } from './audit.service.js';

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
        const modelKey = modelName.toLowerCase();

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
        const collections = ['user', 'department', 'project', 'baptism', 'partnership'];
        const results: any[] = [];

        for (const col of collections) {
            const selectOptions: any = {
                id: true,
                deletedAt: true,
                deletedBy: true,
                deletedReason: true,
            };

            // Add model-specific identifier
            if (col === 'user' || col === 'department') selectOptions.name = true;
            if (col === 'project') selectOptions.title = true;

            const items = await (prisma as any)[col].findMany({
                where: { deletedAt: { not: null } },
                select: selectOptions
            });
            
            results.push(...items.map((item: any) => ({ 
                ...item, 
                type: col.toUpperCase(),
                displayName: item.name || item.title || item.id 
            })));
        }

        return results.sort((a, b) => {
            const timeA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
            const timeB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
            return timeB - timeA;
        });
    }
}
