import { Request, Response } from 'express';
import os from 'os';
import prisma from '../../utils/prisma.js';
import { TelemetryEngine } from '../../utils/health.service.js';
import { io } from '../../utils/socket.js';

/**
 * 2.4.0 Kernel: System Administration Command
 * Provides granular observability directly to the SYSTEM_ADMIN dashboard.
 */
export const getSystemHealth = async (req: Request, res: Response) => {
    try {
        // 1. Fetch latest Historical Matrix from Database 
        // (Logged by the native TelemetryEngine background worker)
        const recentMetrics = await prisma.systemMetric.findMany({
            take: 60, // Last 5 minutes roughly (5s pulses)
            orderBy: { createdAt: 'desc' }
        });

        // 2. Compute live instantaneous stats to supplement
        const activeUsers = io?.engine?.clientsCount || 0;
        
        // 3. Environment & Hardware integrity
        const uptime = process.uptime();
        const loadAvg = os.loadavg(); // [1, 5, 15] minutes
        const memory = process.memoryUsage();
        
        res.json({
            status: 'OPERATIONAL',
            version: '2.4.0-Kernel',
            uptime,
            current: {
                activeWebSockets: activeUsers,
                cpuLoad: loadAvg[0],
                memoryHeapMB: Math.round(memory.heapUsed / 1024 / 1024),
                totalErrors: TelemetryEngine.errorCount
            },
            history: recentMetrics
        });
    } catch (error: any) {
        console.error('[SYSTEM_HEALTH_ERROR]', error);
        res.status(500).json({ error: 'Kernel Integrity Check Failed.' });
    }
};
