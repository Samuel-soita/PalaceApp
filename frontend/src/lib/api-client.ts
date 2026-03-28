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

    // ⚡ PROACTIVE IDEMPOTENCY (v2.4.0 Resilience)
    if (['post', 'put', 'delete'].includes(config.method?.toLowerCase() || '')) {
        const idempotencyKey = crypto.randomUUID();
        config.headers['X-Idempotency-Key'] = idempotencyKey;
        (config as any)._idempotencyKey = idempotencyKey;
    }

    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const { config, response } = error;
        
        // 1. CLASSIFY ERROR
        const isMutation = ['post', 'put', 'delete'].includes(config?.method?.toLowerCase() || '');
        const isNetworkError = !response || response.status >= 500;
        const isValidationError = response?.status >= 400 && response?.status < 500;

        // 2. STRATEGIC QUEUEING (Enterprise Logic)
        if (isMutation && (isNetworkError || !navigator.onLine) && !isValidationError) {
            console.warn('[Palace-Portal] Mission Interrupted or Offline. Queuing for Resilient Dispatch...', config.url);
            
            try {
                // Get User Role for Priority Sorting & Conflict Resolution
                const userRaw = localStorage.getItem('user');
                const user = userRaw ? JSON.parse(userRaw) : null;
                const userRole = user?.role || 'MEMBER';

                // Re-use request-level idempotency key
                const idempotencyKey = (config as any)._idempotencyKey || crypto.randomUUID();
                
                // Determine Priority (High for financial/spiritual, Medium for general updates)
                const priority: 'HIGH' | 'MEDIUM' | 'LOW' = 
                    config.url?.includes('/partnerships') || 
                    config.url?.includes('/plans') ||
                    config.url?.includes('/devotions') ||
                    config.url?.includes('/children') ? 'HIGH' : 'MEDIUM';

                const queuedUrl = config.url?.startsWith('http') || config.url?.startsWith('/') ? config.url : `/api/${config.url}`;

                const action = await queueAction({
                    url: queuedUrl || '',
                    idempotencyKey,
                    method: config.method?.toUpperCase() as any,
                    payload: config.data ? (typeof config.data === 'string' ? JSON.parse(config.data) : config.data) : null,
                    headers: {
                        ...config.headers,
                        'X-Idempotency-Key': idempotencyKey
                    } as any,
                    priority,
                    userRole
                });

                if (!action) return Promise.reject(error); // Queue overflow

                // Return Optimistic Success (202 Accepted)
                return Promise.resolve({
                    data: { _queued: true, actionId: action.id, message: 'Mission Queued Offline' },
                    status: 202,
                    statusText: 'Accepted (Queued)',
                    headers: {},
                    config,
                });
            } catch (queueError) {
                console.error('[Palace-Portal] Dispatch Failure:', queueError);
            }
        }

        return Promise.reject(error);
    }
);

export default api;

