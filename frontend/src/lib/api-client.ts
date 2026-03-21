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
        
        // 1. CLASSIFY ERROR
        const isMutation = ['post', 'put', 'delete'].includes(config?.method?.toLowerCase() || '');
        const isNetworkError = !response || response.status >= 500;
        const isValidationError = response?.status >= 400 && response?.status < 500;

        // 2. STRATEGIC QUEUEING (Enterprise Logic)
        if (isMutation && isNetworkError && !isValidationError) {
            console.warn('[Palace-Portal] Mission Interrupted. Queuing for Resilient Dispatch...', config.url);
            
            try {
                // Generate Idempotency Key for this specific request
                const idempotencyKey = crypto.randomUUID();
                
                // Determine Priority (High for financial/strategic, Medium for general updates)
                const priority: 'HIGH' | 'MEDIUM' | 'LOW' = 
                    config.url?.includes('/partnerships') || config.url?.includes('/plans') ? 'HIGH' : 'MEDIUM';

                const queuedUrl = config.url?.startsWith('http') || config.url?.startsWith('/') ? config.url : `/api/${config.url}`;

                const action = await queueAction({
                    url: queuedUrl || '',
                    idempotencyKey,
                    method: config.method?.toUpperCase() as any,
                    payload: config.data ? JSON.parse(config.data) : null,
                    headers: {
                        ...config.headers,
                        'X-Idempotency-Key': idempotencyKey
                    } as any,
                    priority
                });

                if (!action) return Promise.reject(error); // Queue overflow

                // Return Optimistic Success (202 Accepted)
                return Promise.resolve({
                    data: { _queued: true, actionId: action.id, message: 'Mission Queued' },
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

