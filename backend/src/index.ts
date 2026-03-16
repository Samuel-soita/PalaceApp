import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './modules/auth/auth.routes.js';
import departmentRoutes from './modules/departments/departments.routes.js';
import meetingRoutes from './modules/meetings/meetings.routes.js';
import budgetRoutes from './modules/budgets/budgets.routes.js';
import announcementRoutes from './modules/announcements/announcements.routes.js';
import assetRoutes from './modules/assets/assets.routes.js';
import eventRoutes from './modules/events/events.routes.js';
import projectRoutes from './modules/projects/projects.routes.js';
import planRoutes from './modules/plans/plans.routes.js';
import messageRoutes from './modules/messages/messages.routes.js';
import notificationRoutes from './modules/notifications/notifications.routes.js';
import supportRoutes from './modules/support/support.routes.js';
import usersRoutes from './modules/users/users.routes.js';

import { createServer } from 'http';
import { initSocket } from './utils/socket.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

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

// API Routes
app.use('/auth', authRoutes);
app.use('/departments', departmentRoutes);
app.use('/meetings', meetingRoutes);
app.use('/budgets', budgetRoutes);
app.use('/announcements', announcementRoutes);
app.use('/assets', assetRoutes);
app.use('/events', eventRoutes);
app.use('/projects', projectRoutes);
app.use('/plans', planRoutes);
app.use('/messages', messageRoutes);
app.use('/notifications', notificationRoutes);
app.use('/support', supportRoutes);
app.use('/users', usersRoutes);
import searchRoutes from './modules/search/search.routes.js';
app.use('/search', searchRoutes);
import uploadRoutes from './modules/upload/upload.routes.js';
app.use('/upload', uploadRoutes);

// SILENCE DEVTOOLS NOISE
app.get('/.well-known/*', (req, res) => res.status(204).end());

initSocket(httpServer);

httpServer.listen(port, () => {
    console.log(`[server]: ChurchHub API running at http://localhost:${port}`);
});
