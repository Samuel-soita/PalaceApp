import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import authRoutes from './modules/auth/auth.routes.js';
import departmentRoutes from './modules/departments/departments.routes.js';
import meetingRoutes from './modules/meetings/meetings.routes.js';
import announcementRoutes from './modules/announcements/announcements.routes.js';
import searchRoutes from './modules/search/search.routes.js';
import uploadRoutes from './modules/upload/upload.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import eventRoutes from './modules/events/events.routes.js';
import projectRoutes from './modules/projects/projects.routes.js';
import planRoutes from './modules/plans/plans.routes.js';
import messageRoutes from './modules/messages/messages.routes.js';
import notificationRoutes from './modules/notifications/notifications.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import childrenRoutes from './modules/children/children.routes.js';
import appointmentsRoutes from './modules/appointments/appointments.routes.js';
import workflowsRoutes from './modules/workflows/workflows.routes.js';
import devotionsRoutes from './modules/devotions/devotions.routes.js';
import supportRoutes from './modules/support/support.routes.js';
import budgetsRoutes from './modules/budgets/budgets.routes.js';
import settingsRoutes from './modules/settings/settings.routes.js';
import partnershipsRoutes from './modules/partnerships/partnerships.routes.js';
import permissionsRoutes from './modules/permissions/permissions.routes.js';
import financeRoutes from './modules/finance/finance.routes.js';
import reportRoutes from './modules/reports/reports.routes.js';
import repairRoutes from './modules/repairs/repairs.routes.js';
import { bootstrapSystem } from './utils/bootstrap.js';
import recoveryRoutes from './modules/recovery/recovery.routes.js';
import syncRoutes from './modules/sync/sync.routes.js';
import healthRoutes from './modules/health/health.routes.js';
import cluster from 'cluster';
import os from 'os';
import prisma from './utils/prisma.js';

import { createServer } from 'http';
import { initSocket } from './utils/socket.js';
import { BackgroundJobWorker } from './utils/JobWorker.js';
import { TelemetryEngine } from './utils/health.service.js';

import compression from 'compression';

dotenv.config();

const app = express();
app.set('trust proxy', 1); // Trust Render Proxy for rate-limiting
const httpServer = createServer(app);
const port = process.env.PORT || 4000;

app.use(compression({
    level: 6, // Balanced speed/ratio
    threshold: 1024, // Compress anything over 1KB
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
    }
}));
app.use(cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Idempotency-Key', 'X-Device-Id']
}));
app.use(express.json());

// --- EMERGENCY DIAGNOSTIC: Root & Heartbeat (Defined BEFORE clustering) ---
console.log('[System] Diagnostic Heartbeat Engine: Primed');
app.get('/', (req, res) => res.json({ status: 'ALIVE', message: 'System Kernel is Responsive.', timestamp: new Date().toISOString() }));
app.get('/ping-db', async (req, res) => {
    try {
        console.log('[Diagnostic] Ping-DB Triggered');
        await (prisma as any).$queryRaw`SELECT 1`;
        res.json({ status: 'HEALTHY', message: 'Database connected successfully.' });
    } catch (error: any) {
        console.error('[Diagnostic] Ping-DB FAILED:', error.message);
        res.status(500).json({ status: 'CRITICAL', error: error.message, stack: error.stack });
    }
});

// --- PRODUCTION SCALABILITY: RATE LIMITING ---
// Relaxed for high-concurrency (400+ users). 
// One dashboard load = ~9 API calls. 400 users = 3,600 calls capacity needed.
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20000, // Enterprise-Scale for 1000+ concurrent mission bursts
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again after a minute.' }
});


// Apply to all routes
app.use(limiter);

// Skip redundant loginRateLimiter at the root if it's already in authRoutes
// app.use('/auth/login', loginRateLimiter);

// Permissive CSP for development to resolve DevTools and connectivity issues
// app.use((req, res, next) => {
//     res.setHeader(
//         'Content-Security-Policy',
//         "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://localhost:4000 ws://localhost:4000;"
//     );
//     next();
// });

// Static file serving
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const numCPUs = os.cpus().length;
// --- MINIMUM CONNECTION MODE: Single Process for Free Tier Stability ---
const useCluster = false; // process.env.NODE_ENV === 'production' && !process.env.NO_CLUSTER;

if (useCluster && cluster.isPrimary) {
    console.log(`[master]: Primary process ${process.pid} is running`);
    
    // --- MASTER-ONLY INITIALIZATION: Self-Healing System Bootstrap ---
    // We prepare the database once before any workers start to prevent collisions
    try {
        await bootstrapSystem();
        console.log('[master]: System Bootstrap successful.');
    } catch (error) {
        console.error('[master]: System Bootstrap failed critical mission:', error);
    }

    BackgroundJobWorker.ignite();
    TelemetryEngine.ignite();
    
    // Cap workers at 2 for stability on limited DB plans (Aiven Free)
    const workerCount = Math.min(numCPUs, 2);
    for (let i = 0; i < workerCount; i++) {
        cluster.fork();
    }
    cluster.on('exit', (worker, code, signal) => {
        console.log(`[master]: Worker ${worker.process.pid} died. Respawning...`);
        cluster.fork();
    });
} else {
    // API Routes
    app.use('/auth', authRoutes);
    app.use('/users', usersRoutes);
    app.use('/dashboard', dashboardRoutes);
    app.use('/departments', departmentRoutes);
    app.use('/meetings', meetingRoutes);
    app.use('/announcements', announcementRoutes);
    app.use('/events', eventRoutes);
    app.use('/projects', projectRoutes);
    app.use('/plans', planRoutes);
    app.use('/messages', messageRoutes);
    app.use('/notifications', notificationRoutes);
    app.use('/appointments', appointmentsRoutes);
    app.use('/children', childrenRoutes);
    app.use('/workflows', workflowsRoutes);
    app.use('/devotions', devotionsRoutes);
    app.use('/support', supportRoutes);
    app.use('/budgets', budgetsRoutes);
    app.use('/settings', settingsRoutes);
    app.use('/partnerships', partnershipsRoutes);
    app.use('/search', searchRoutes);
    app.use('/upload', uploadRoutes);
    app.use('/permissions', permissionsRoutes);
    app.use('/finance', financeRoutes);
    app.use('/reports', reportRoutes);
    app.use('/repairs', repairRoutes);
    app.use('/recovery', recoveryRoutes);
    app.use('/sync', syncRoutes);
    app.use('/system-health', healthRoutes);

    // SILENCE DEVTOOLS NOISE
    app.get('/.well-known/*', (req, res) => res.status(204).end());

    initSocket(httpServer);

    // --- SOPHISTICATED GLOBAL ERROR HANDLER ---
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
        TelemetryEngine.incrementError();
        
        let statusCode = err.statusCode || 500;
        let message = err.message || 'Mission Integrity Compromised: System Error Detected.';
        let details = err.details || null;

        // 1. Handle Zod Validation Errors
        if (err.name === 'ZodError') {
            statusCode = 400;
            message = 'Validation Failed';
            details = err.errors.map((e: any) => ({
                path: e.path.join('.'),
                message: e.message
            }));
        }

        // 2. Handle Prisma Known Errors
        if (err.code === 'P2002') {
            statusCode = 409;
            message = `Conflict: A record with this unique identifier already exists (${err.meta?.target})`;
        }

        // 3. Handle JWT Errors
        if (err.name === 'JsonWebTokenError') {
            statusCode = 401;
            message = 'Invalid authentication token';
        }
        if (err.name === 'TokenExpiredError') {
            statusCode = 401;
            message = 'Authentication token expired';
        }

        console.error(`[ERROR ${statusCode}] ${req.method} ${req.path}:`, err);

        res.status(statusCode).json({
            error: true,
            status: 'error',
            message,
            details,
            isOperational: err.isOperational || false,
            path: req.path,
            timestamp: new Date().toISOString()
        });
    });

    const PORT = process.env.PORT || 4000;
    httpServer.listen(PORT, async () => {
        console.log(`[worker]: Worker ${process.pid} started. API running at http://localhost:${PORT}`);
        
        if (!useCluster) {
            // --- HYBRID INITIALIZATION: Self-Healing System Bootstrap ---
            try {
                await bootstrapSystem();
                console.log('[worker]: System Bootstrap successful.');
            } catch (error) {
                console.error('[worker]: System Bootstrap failed critical mission:', error);
            }
            BackgroundJobWorker.ignite();
            TelemetryEngine.ignite();
        }
    });
}
