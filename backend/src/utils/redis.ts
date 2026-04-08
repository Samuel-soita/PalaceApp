import { Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => Math.min(times * 50, 2000),
});

redis.on('error', (err: any) => console.error('[Redis Error]', err));
redis.on('connect', () => console.log('[Redis] Connected to Cache Layer'));

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
            return JSON.parse(cached);
        }

        // If a fetch is already in flight for this key, join it
        if (pendingPromises.has(key)) {
            console.log(`[Single-Flight] Joining in-flight request for: ${key}`);
            return pendingPromises.get(key);
        }

        // Otherwise, start a new fetch with a timeout and track it
        const fetchPromise = (async () => {
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Fetch timed out for key: ${key}`)), 10000)
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
        return fetchPromise;
    } catch (error) {
        console.warn(`[Cache Miss/Error] ${key}:`, error);
        // If it's a timeout or Redis error, try one last fresh fetch without caching
        return fetchFn();
    }
}

export async function getCachedData(key: string): Promise<any | null> {
    try {
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`[Redis Get Error] ${key}:`, error);
        return null;
    }
}

export async function setCachedData(key: string, data: any, ttlSeconds: number = 300) {
    try {
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
