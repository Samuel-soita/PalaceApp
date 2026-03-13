import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './modules/auth/auth.routes.js';
import departmentRoutes from './modules/departments/departments.routes.js';
import meetingRoutes from './modules/meetings/meetings.routes.js';
import budgetRoutes from './modules/budgets/budgets.routes.js';
import announcementRoutes from './modules/announcements/announcements.routes.js';
import prayerRequestRoutes from './modules/prayer-requests/prayer-requests.routes.js';
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

// API Routes
app.use('/auth', authRoutes);
app.use('/departments', departmentRoutes);
app.use('/meetings', meetingRoutes);
app.use('/budgets', budgetRoutes);
app.use('/announcements', announcementRoutes);
app.use('/prayer-requests', prayerRequestRoutes);
app.use('/assets', assetRoutes);
app.use('/events', eventRoutes);
app.use('/projects', projectRoutes);
app.use('/plans', planRoutes);
app.use('/messages', messageRoutes);
app.use('/notifications', notificationRoutes);
app.use('/support', supportRoutes);
app.use('/users', usersRoutes);

initSocket(httpServer);

httpServer.listen(port, () => {
    console.log(`[server]: ChurchHub API running at http://localhost:${port}`);
});
