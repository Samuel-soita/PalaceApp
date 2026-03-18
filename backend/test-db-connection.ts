import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
});

async function main() {
    try {
        console.log('Testing connection...');
        await prisma.$connect();
        console.log('✅ Connection successful!');
        const users = await prisma.user.findMany({ take: 1 });
        console.log('Found users:', users);
    } catch (e: any) {
        console.error('❌ Connection failed:');
        console.error(e.message || e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
