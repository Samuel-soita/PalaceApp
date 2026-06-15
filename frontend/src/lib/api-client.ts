import axios from 'axios';
import { expireSessionIfNeeded, handleSessionExpired, isOnlineSessionActive, isTokenExpired } from './auth-session';

const api = axios.create({
    baseURL: (import.meta.env.VITE_API_URL as string) || '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    const isAuthRoute = config.url?.startsWith('/auth/login')
        || config.url?.startsWith('/auth/register')
        || config.url?.startsWith('/auth/watua-access');

    if (token && !isAuthRoute) {
        if (token.startsWith('offline_token_')) {
            return Promise.reject(Object.assign(new Error('Offline session'), { code: 'OFFLINE_SESSION' }));
        }
        if (!isOnlineSessionActive() || isTokenExpired(token)) {
            handleSessionExpired('Session expired');
            return Promise.reject(Object.assign(new Error('Session expired'), { code: 'SESSION_EXPIRED' }));
        }
        config.headers.Authorization = `Bearer ${token}`;
    }

    // ⚡ PROACTIVE IDEMPOTENCY
    if (['post', 'put', 'delete'].includes(config.method?.toLowerCase() || '')) {
        const idempotencyKey = crypto.randomUUID();
        config.headers['X-Idempotency-Key'] = idempotencyKey;
    }

    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error?.code === 'SESSION_EXPIRED' || error?.code === 'OFFLINE_SESSION') {
            return Promise.reject(error);
        }
        if (error.response?.status === 401) {
            handleSessionExpired(error.response?.data?.error || 'Session expired');
        }
        return Promise.reject(error);
    }
);

export default api;

