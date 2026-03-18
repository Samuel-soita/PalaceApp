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
import cluster from 'cluster';
import os from 'os';

import { createServer } from 'http';
import { initSocket } from './utils/socket.js';

import compression from 'compression';

dotenv.config();

const app = express();
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
app.use(cors());
app.use(express.json());

// --- PRODUCTION SCALABILITY: RATE LIMITING ---
// Relaxed for high-concurrency (400+ users). 
// One dashboard load = ~9 API calls. 400 users = 3,600 calls capacity needed.
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5000, // Increased for 600-user advanced audit
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
const useCluster = process.env.NODE_ENV === 'production' && !process.env.NO_CLUSTER;

if (useCluster && cluster.isPrimary) {
    console.log(`[master]: Primary process ${process.pid} is running`);
    for (let i = 0; i < numCPUs; i++) {
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

    // SILENCE DEVTOOLS NOISE
    app.get('/.well-known/*', (req, res) => res.status(204).end());

    initSocket(httpServer);

    // Error Handling Middleware
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
        console.error('[Error]', err.message || err);
        res.status(500).json({ 
            error: 'Internal Server Error',
            message: 'Something went wrong on the mission server.'
        });
    });

    const PORT = process.env.PORT || 4000;
    httpServer.listen(PORT, () => {
        console.log(`[worker]: Worker ${process.pid} started. API running at http://localhost:${PORT}`);
    });
}
