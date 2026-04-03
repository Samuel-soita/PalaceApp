import axios from 'axios';

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
        // True Local-First architecture implies api-client is strictly for daemon syncing
        // and hard-online modules (Finance). 
        // Any errors are genuinely returned to the caller to handle.
        return Promise.reject(error);
    }
);

export default api;

