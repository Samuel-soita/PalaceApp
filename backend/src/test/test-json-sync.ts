
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
    try {
        const where = { id: 'test' };
        console.log('Testing simple where:', JSON.stringify(where));
        
        // This is what Prisma might pass internally
        const complexWhere = { AND: [{ id: 'test' }] };
        console.log('Testing complex where:', JSON.stringify(complexWhere));
        
        console.log('Test successful');
    } catch (e) {
        console.error('Test failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

test();
