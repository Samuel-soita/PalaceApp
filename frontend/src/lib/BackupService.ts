import { db } from './db';
import { DeviceService } from './DeviceService';

/**
 * 💾 Backup & Recovery Service
 * Provides full-stack data resilience for a 100% offline environment.
 * Enables JSON-based export/import of the entire browser kernel.
 */

export interface BackupPayload {
    metadata: {
        version: number;
        timestamp: string;
        deviceId: string;
        tableCount: number;
    };
    data: Record<string, any[]>;
}

export const BackupService = {
    /**
     * Aggregates all Dexie stores into a encrypted-capable JSON payload for export.
     */
    async exportToJSON(): Promise<void> {
        console.log('[BackupService] Initiating full system export...');
        const deviceId = await DeviceService.getDeviceId();
        const tables = db.tables;
        const backup: BackupPayload = {
            metadata: {
                version: db.verno,
                timestamp: new Date().toISOString(),
                deviceId,
                tableCount: tables.length
            },
            data: {}
        };

        for (const table of tables) {
            backup.data[table.name] = await table.toArray();
        }

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `palace_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Update last backup timestamp
        await db.deviceSettings.update('current_device', { lastBackupAt: new Date().toISOString() });
        console.log('[BackupService] System export complete. File triggered.');
    },

    /**
     * Validates and restores a system backup package.
     * WARNING: This performs a destructive update of existing local data.
     */
    async importFromJSON(file: File): Promise<{ success: boolean; message: string }> {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const payload: BackupPayload = JSON.parse(e.target?.result as string);

                    // 1. Structural Validation
                    if (!payload.metadata || !payload.data) {
                        throw new Error('Invalid backup format: Missing metadata or data payload.');
                    }

                    if (payload.metadata.version !== db.verno) {
                        throw new Error(`Version Mismatch: Backup is v${payload.metadata.version}, System is v${db.verno}. Migrate before import.`);
                    }

                    // 2. Destructive Transactional Restore
                    await db.transaction('rw', db.tables, async () => {
                        for (const tableName in payload.data) {
                            const table = db.table(tableName);
                            if (table) {
                                await table.clear();
                                await table.bulkAdd(payload.data[tableName]);
                            }
                        }
                    });

                    console.log('[BackupService] System restore successful. Kernel reloaded.');
                    resolve({ success: true, message: 'System restored successfully. Reloading data...' });
                } catch (err: any) {
                    console.error('[BackupService] Restore failed:', err);
                    resolve({ success: false, message: err.message });
                }
            };
            reader.readAsText(file);
        });
    }
};
