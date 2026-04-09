import { bootstrapSystem } from '../src/utils/bootstrap.js';
import { prisma } from '../src/utils/prisma.js';

async function main() {
    try {
        await bootstrapSystem();
    } catch (e) {
        console.error('Bootstrap failed:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
