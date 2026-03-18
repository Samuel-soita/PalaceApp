import { Redis } from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
console.log('Testing Redis connection to:', redisUrl);

const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
});

async function main() {
    try {
        await redis.set('test-key', 'hello');
        const val = await redis.get('test-key');
        console.log('✅ Redis connection successful! Value:', val);
    } catch (e: any) {
        console.error('❌ Redis connection failed:');
        console.error(e.message || e);
    } finally {
        redis.disconnect();
    }
}

main();
