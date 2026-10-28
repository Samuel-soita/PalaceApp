import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

export let io: Server;

export const initSocket = (server: HttpServer) => {
    io = new Server(server, {
        cors: {
            origin: '*', // Adjust for production
            methods: ['GET', 'POST'],
        },
    });

    io.on('connection', (socket) => {
        console.log('A user connected:', socket.id);

        socket.on('join-room', (roomId: string) => {
            socket.join(roomId);
            console.log(`User ${socket.id} joined room ${roomId}`);
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });
    });

    return io;
};

export const emitToRoom = (roomId: string, event: string, data: any) => {
    if (io) {
        io.to(roomId).emit(event, data);
    }
};

export const emitNotification = (userId: string, data: any) => {
    if (io) {
        io.to(`user-${userId}`).emit('notification', data);
    }
};

// Coalesce bursts (e.g. a controller broadcast plus the realtime middleware) into one event per module.
const BROADCAST_WINDOW_MS = 300;
const pendingModules = new Set<string>();
let broadcastTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Tells every connected client that a data module changed. Carries no record data:
 * clients re-pull through their own auth-scoped /sync endpoints.
 */
export const broadcastSync = (...moduleNames: string[]) => {
    if (!io) return;
    moduleNames.forEach(m => pendingModules.add(m));
    if (broadcastTimer) return;
    broadcastTimer = setTimeout(() => {
        const modules = [...pendingModules];
        pendingModules.clear();
        broadcastTimer = null;
        const timestamp = Date.now();
        for (const module of modules) io.emit('sync-update', { module, timestamp });
    }, BROADCAST_WINDOW_MS);
};
