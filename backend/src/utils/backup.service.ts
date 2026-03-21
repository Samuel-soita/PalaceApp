import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';
import { logAction } from './audit.service.js';

const execPromise = util.promisify(exec);

export class BackupEngine {
    /**
     * Executes a fully isolated database snapshot via pg_dump.
     * Guaranteed immutable logging for auditing compliance.
     */
    static async createSnapshot(actorId: string): Promise<string> {
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) throw new Error('DATABASE_URL is missing. Cannot initialize backup kernel.');

        const backupDir = path.join(process.cwd(), '..', 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `palacehub_snapshot_${timestamp}.sql`;
        const filepath = path.join(backupDir, filename);

        // Sanitize logs
        const safeUrlLogs = dbUrl.replace(/\/\/.*@/, '//***:***@');

        try {
            console.log(`[Disaster Recovery] Initiating pg_dump to ${filepath}...`);
            await execPromise(`pg_dump "${dbUrl}" > "${filepath}"`);
            
            await logAction({
                actorId: actorId || 'SYSTEM_CRON',
                actionType: 'DATABASE_SNAPSHOT_CREATED',
                entityType: 'DISASTER_RECOVERY',
                entityId: filename,
                metadata: { filepath, target: safeUrlLogs },
            });

            return filepath;
        } catch (error: any) {
            console.error('[Backup Engine Error]', error.message);
            
            await logAction({
                actorId: actorId || 'SYSTEM_CRON',
                actionType: 'DATABASE_SNAPSHOT_FAILED',
                entityType: 'DISASTER_RECOVERY',
                entityId: filename,
                metadata: { error: error.message },
            });

            throw new Error('Kernel failed to extract Postgres snapshot. Ensure pg_dump is natively installed on the host.');
        }
    }
}
