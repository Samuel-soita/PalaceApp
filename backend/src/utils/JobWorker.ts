import cron from 'node-cron';
import prisma from './prisma.js';
import { logAction } from './audit.service.js';

export class BackgroundJobWorker {
    private static isRunning = false;

    /**
     * Starts the global Job Queue Poller.
     * Polls the `JobQueue` table every minute for PENDING or RETRYING jobs.
     */
    static ignite() {
        console.log('[System Kernel] Igniting Background Job Worker...');
        
        // Run every minute
        cron.schedule('* * * * *', async () => {
            if (this.isRunning) return; // Prevent race conditions
            this.isRunning = true;

            try {
                await this.processQueue();
            } catch (error) {
                console.error('[BackgroundJobWorker FATAL POLL ERROR]', error);
            } finally {
                this.isRunning = false;
            }
        });
    }

    private static async processQueue() {
        // Grab up to 50 pending jobs to avoid overwhelming worker thread
        const jobs = await prisma.jobQueue.findMany({
            where: {
                status: { in: ['PENDING', 'RETRYING'] }
            },
            take: 50,
            orderBy: { createdAt: 'asc' } // FIFO
        });

        if (jobs.length === 0) return;

        console.log(`[Job Worker] Pulled ${jobs.length} jobs for execution.`);

        for (const job of jobs) {
            try {
                // 1. Mark PROCESSING
                await prisma.jobQueue.update({
                    where: { id: job.id },
                    data: { status: 'PROCESSING' }
                });

                // 2. Execute Payload Logic
                const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
                
                await this.executeJob(job.type, payload);

                // 3. Mark COMPLETED
                await prisma.jobQueue.update({
                    where: { id: job.id },
                    data: { status: 'COMPLETED', processedAt: new Date() }
                });

            } catch (error: any) {
                console.error(`[Job Worker] Job ${job.id} failed:`, error.message);
                
                // 4. Retry Logic
                const nextAttempts = job.attempts + 1;
                const nextStatus = nextAttempts > 3 ? 'FAILED' : 'RETRYING';
                
                await prisma.jobQueue.update({
                    where: { id: job.id },
                    data: { 
                        status: nextStatus,
                        attempts: nextAttempts
                    }
                });

                if (nextStatus === 'FAILED') {
                    await logAction({
                        actorId: 'SYSTEM',
                        actionType: 'JOB_DEAD_LETTER',
                        entityType: 'JOB_QUEUE',
                        entityId: job.id,
                        metadata: { type: job.type, error: error.message },
                    });
                }
            }
        }
    }

    private static async executeJob(type: string, payload: any) {
        // Simulate external API delivery (Idempotent mock processors)
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (Math.random() > 0.95) {
                    reject(new Error(`Simulated Network Failure during ${type} delivery.`));
                } else {
                    console.log(`[Job Executor] Successfully executed ${type} to ${payload.target}`);
                    resolve(true);
                }
            }, 200);
        });
    }
}
