import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function audit() {
    const id = '4c9ec138-7569-46e5-b568-e3ec8429a6b7';
    const logs = await prisma.auditLog.findMany({ where: { entityId: id } });
    console.log('Audit Logs:', logs);
    await prisma.$disconnect();
}
audit();
