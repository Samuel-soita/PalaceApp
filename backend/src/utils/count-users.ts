import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function count() {
    console.log('Users:', await prisma.user.count());
    await prisma.$disconnect();
}
count();
