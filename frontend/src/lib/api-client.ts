import axios from 'axios';
import { queueAction } from './pwa-sync';

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const { config, response } = error;
        
        // Only queue mutating requests (POST, PUT, DELETE)
        const isMutation = ['post', 'put', 'delete'].includes(config?.method?.toLowerCase() || '');
        
        // Queue if offline (no response) or server is temporarily unavailable (503, 504)
        const isNetworkError = !response;
        const isServerError = response?.status === 503 || response?.status === 504;

        if (isMutation && (isNetworkError || isServerError)) {
            console.warn('[API-Client] Offline or server error detected for mutation. Queuing action...', config.url);
            
            try {
                await queueAction({
                    url: config.url || '',
                    method: config.method?.toUpperCase() as any,
                    data: config.data ? JSON.parse(config.data) : null,
                    headers: config.headers,
                });

                // Return a fake success response to prevent UI from breaking
                // This is an "Optimistic" approach. The user gets immediate feedback.
                return Promise.resolve({
                    data: { _queued: true, message: 'Action queued for offline sync' },
                    status: 202,
                    statusText: 'Accepted (Queued)',
                    headers: {},
                    config,
                });
            } catch (queueError) {
                console.error('[API-Client] Failed to queue action:', queueError);
            }
        }

        return Promise.reject(error);
    }
);

export default api;

