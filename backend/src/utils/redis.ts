import { Redis } from 'ioredis';

let redis: Redis;
let isCircuitOpen = false;
let failureCount = 0;
const MAX_FAILURES = 3;

// 🧠 IN-MEMORY FALLBACK CACHE (Process-Local Layer)
// This ensures that even if Redis fails, we still have a functional (though not shared) cache layer.
const memoryCache = new Map<string, { value: string, expiry: number }>();

const dummyRedis = {
    status: 'ready',
    on: () => {},
    get: async (key: string) => {
        const item = memoryCache.get(key);
        if (item && item.expiry > Date.now()) return item.value;
        if (item) memoryCache.delete(key);
        return null;
    },
    set: async (key: string, value: string) => {
        // Set with default day TTL if not specified via setex
        memoryCache.set(key, { value, expiry: Date.now() + (86400 * 1000) });
    },
    setex: async (key: string, ttl: number, value: string) => {
        memoryCache.set(key, { value, expiry: Date.now() + (ttl * 1000) });
    },
    del: async (...keys: string[]) => {
        keys.forEach(k => memoryCache.delete(k));
    },
    incr: async (key: string) => {
        const item = memoryCache.get(key);
        let val = 0;
        if (item && !isNaN(parseInt(item.value))) {
            val = parseInt(item.value);
        }
        val++;
        memoryCache.set(key, { value: val.toString(), expiry: Date.now() + (86400 * 1000) });
        return val;
    },
    keys: async (pattern: string) => {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return Array.from(memoryCache.keys()).filter(k => regex.test(k));
    },
    disconnect: () => {}
} as any;

const initializeRedis = () => {
    if (process.env.REDIS_URL && !isCircuitOpen) {
        try {
            const client = new Redis(process.env.REDIS_URL, {
                maxRetriesPerRequest: 1,
                connectTimeout: 5000,
                retryStrategy: (times: number) => {
                    const delay = Math.min(times * 200, 2000);
                    if (times > MAX_FAILURES) {
                        console.error('[Redis Service] Max connection retries reached. Opening Circuit.');
                        isCircuitOpen = true;
                        redis = dummyRedis;
                        
                        // ⏱️ Start Re-Discovery Timer (Try again in 15 mins)
                        setTimeout(() => {
                            console.log('[Redis] Attempting to close circuit and re-discover cache host...');
                            isCircuitOpen = false;
                            redis = initializeRedis();
                        }, 900000); 

                        return null; // Stop this specific instance from retrying
                    }
                    return delay;
                },
            });

            client.on('error', (err: any) => {
                failureCount++;
                console.error(`[Redis Error] Attempt ${failureCount}/${MAX_FAILURES}:`, err.message);
                if (failureCount >= MAX_FAILURES) {
                    console.warn('[Redis] Switching to Local Memory Cache (Circuit Open)');
                    isCircuitOpen = true;
                    redis = dummyRedis;
                    client.disconnect();
                }
            });

            client.on('connect', () => {
                console.log('[Redis] Connected to Cache Layer');
                failureCount = 0;
            });

            return client;
        } catch (e) {
            console.error('[Redis Init Failed]', e);
            isCircuitOpen = true;
            return dummyRedis;
        }
    }
    
    console.warn('[Redis] Cache layer starting in Memory Mode.');
    return dummyRedis;
};

redis = initializeRedis();

const pendingPromises = new Map<string, Promise<any>>();

/**
 * Cache Wrapper: Get from cache or fetch and set
 * Implements Single-Flight pattern to prevent Thundering Herd on cache miss.
 */
export async function getOrSetCache<T>(key: string, fetchFn: () => Promise<T>, ttlSeconds: number = 300): Promise<T> {
    try {
        // --- RESILIENT FALLBACK: Check connection before attempting get ---
        if (redis.status !== 'ready') {
            return await fetchFn();
        }

        const cached = await redis.get(key);
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (e) {
                console.error(`[Cache Corruption] Invalid JSON for key ${key}:`, cached);
                await redis.del(key);
            }
        }

        // If a fetch is already in flight for this key, join it
        if (pendingPromises.has(key)) {
            console.log(`[Single-Flight] Joining in-flight request for: ${key}`);
            return pendingPromises.get(key);
        }

        // Otherwise, start a new fetch with a timeout and track it
        const fetchPromise = (async () => {
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Fetch timed out for key: ${key}`)), 30000)
            );

            try {
                // Race the fetch against a 10s timeout
                const freshData = await Promise.race([
                    fetchFn(),
                    timeoutPromise
                ]) as T;

                await redis.setex(key, ttlSeconds, JSON.stringify(freshData));
                return freshData;
            } finally {
                // Ensure we always clean up the tracking map so subsequent requests can try again
                pendingPromises.delete(key);
            }
        })();

        pendingPromises.set(key, fetchPromise);
        return await fetchPromise;
    } catch (error: any) {
        console.warn(`[Cache Miss/Error] ${key}:`, error);
        if (error?.message && error.message.includes('Fetch timed out')) {
            throw error; // Prevent cascading database overload on timeout
        }
        // If it's a Redis error or some other transient issue, try one last fresh fetch without caching
        return fetchFn();
    }
}

export async function getCachedData(key: string): Promise<any | null> {
    try {
        if (redis.status !== 'ready') return null;
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`[Redis Get Error] ${key}:`, error);
        return null;
    }
}

export async function setCachedData(key: string, data: any, ttlSeconds: number = 300) {
    try {
        if (redis.status !== 'ready') return;
        await redis.setex(key, ttlSeconds, JSON.stringify(data));
    } catch (error) {
        console.error(`[Redis Set Error] ${key}:`, error);
    }
}

/**
 * Invalidate Cache (supports glob patterns if needed, though this is simple del)
 */
export async function invalidateCache(pattern: string) {
    try {
        if (redis.status !== 'ready') return;

        if (pattern.includes('*')) {
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } else {
            await redis.del(pattern);
        }
    } catch (error) {
        console.error(`[Cache Invalidation Error] ${pattern}:`, error);
    }
}

export default redis;
