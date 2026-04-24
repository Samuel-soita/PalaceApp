import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function count() {
    const models = ['project', 'event', 'announcement', 'meeting', 'plan'];
    for (const model of models) {
        const total = await (prisma as any)[model].count();
        const active = await (prisma as any)[model].count({ where: { deletedAt: null } });
        console.log(`${model}: Total=${total}, Active=${active}`);
    }
    await prisma.$disconnect();
}
count();
