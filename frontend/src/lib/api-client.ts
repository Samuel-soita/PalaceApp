import axios from 'axios';
import { handleSessionExpired, isOnlineSessionActive, isTokenExpired } from './auth-session';
import { isDemoSession } from '../demo/demo-session';

const api = axios.create({
    baseURL: (import.meta.env.VITE_API_URL as string) || '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

const isAuthRoute = (url?: string) => !!url && (
    url.startsWith('/auth/login')
    || url.startsWith('/auth/register')
    || url.startsWith('/auth/watua-access')
);

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');

    if (token && !isAuthRoute(config.url)) {
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

    // Demo sessions never reach the server: the sample-data backend answers in the browser.
    if (isDemoSession()) {
        config.adapter = (demoConfig) => import('../demo/demo-backend').then((m) => m.demoAdapter(demoConfig));
    }

    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error?.code === 'SESSION_EXPIRED' || error?.code === 'OFFLINE_SESSION') {
            return Promise.reject(error);
        }
        // The global error handler answers `{ error: true, message, details }`; screens read `data.error`.
        const data = error.response?.data;
        if (data && typeof data === 'object' && typeof data.error !== 'string' && typeof data.message === 'string') {
            const details = Array.isArray(data.details)
                ? data.details.map((d: any) => d?.message).filter(Boolean).join('; ')
                : '';
            data.error = details ? `${data.message}: ${details}` : data.message;
        }
        // A 401 from the sign-in endpoints means wrong credentials, not an expired session.
        if (error.response?.status === 401 && !isAuthRoute(error.config?.url)) {
            handleSessionExpired(data?.error || 'Session expired');
        }
        return Promise.reject(error);
    }
);

export default api;

