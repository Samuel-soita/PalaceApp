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
