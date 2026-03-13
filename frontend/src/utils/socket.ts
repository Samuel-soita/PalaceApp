import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const socket = io(SOCKET_URL, {
    autoConnect: false,
});

export const connectSocket = (userId: string) => {
    socket.connect();
    socket.emit('join-room', `user-${userId}`);
};

export const disconnectSocket = () => {
    socket.disconnect();
};
