import { io } from 'socket.io-client';
import { isDemoSession } from '../demo/demo-session';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || ''; // Relative in dev to hit Vite proxy

export const socket = io(SOCKET_URL, {
    autoConnect: false,
});

let currentUserId: string | null = null;

// Rooms are server-side state and are lost on every reconnect, so re-join each time.
socket.on('connect', () => {
    if (currentUserId) socket.emit('join-room', `user-${currentUserId}`);
});

export const connectSocket = (userId: string) => {
    if (isDemoSession()) return;
    currentUserId = userId;
    if (socket.connected) {
        socket.emit('join-room', `user-${userId}`);
    } else {
        socket.connect();
    }
};

export const disconnectSocket = () => {
    currentUserId = null;
    socket.disconnect();
};
