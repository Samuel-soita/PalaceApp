import os from 'os';
import prisma from './prisma.js';
import { emitToRoom, io } from './socket.js';

export class TelemetryEngine {
    private static isRunning = false;
    public static errorCount = 0;

    /**
     * Start the system telemetry broadcast to the WATUA command center
     */
    static ignite() {
        console.log('[System Kernel] Igniting Telemetry Engine...');
        
        setInterval(async () => {
            if (this.isRunning) return;
            this.isRunning = true;

            try {
                await this.broadcastMetrics();
            } catch (err) {
                console.error('[TelemetryEngine ERROR]', err);
            } finally {
                this.isRunning = false;
            }
        }, 5000); // 5-second pulse for real-time Live Dashboard
    }

    static incrementError() {
        this.errorCount++;
    }

    private static async broadcastMetrics() {
        // 1. Measure DB Latency
        const start = performance.now();
        await prisma.$queryRaw`SELECT 1`;
        const latency = performance.now() - start;

        // 2. Count Active WS Connections natively through Socket.io
        let activeUsers = 0;
        if (io) {
            activeUsers = io.engine?.clientsCount || 0;
        }

        // 3. Count Failed Jobs
        const failedJobs = await prisma.jobQueue.count({ where: { status: 'FAILED' } });

        // 4. Count Pending WATUA actions
        const pendingApproval = await prisma.watuaActionLog.count({ where: { executed: false } });

        const metrics = {
            latency: parseFloat(latency.toFixed(2)),
            activeUsers,
            errorCount: this.errorCount,
            failedJobs,
            wsConnections: activeUsers, // Usually mapped 1:1, but can diverge if multiplexing
            pendingApproval,
            cpuLoad: os.loadavg()[0], // 1 minute load average
            memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
            timestamp: new Date().toISOString()
        };

        // 5. Fire to database for historical charting
        await prisma.systemMetric.create({
            data: {
                latency: metrics.latency,
                activeUsers: metrics.activeUsers,
                errorCount: metrics.errorCount,
                failedJobs: metrics.failedJobs,
                wsConnections: metrics.wsConnections,
                pendingApproval: metrics.pendingApproval
            }
        });

        // 6. Push via WebSockets to 'watua_dash' room
        emitToRoom('watua_dash', 'system_telemetry', metrics);
    }
}
