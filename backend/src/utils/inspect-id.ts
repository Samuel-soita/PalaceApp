import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function inspect() {
    const id = '4c9ec138-7569-46e5-b568-e3ec8429a6b7';
    const a = await prisma.announcement.findUnique({ where: { id } });
    console.log('Announcement:', a);
    await prisma.$disconnect();
}
inspect();
