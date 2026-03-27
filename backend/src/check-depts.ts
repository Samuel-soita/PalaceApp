import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkDepts() {
    const depts = await prisma.department.findMany();
    console.log('Current Departments in DB:');
    depts.forEach(d => console.log(`- ${d.name}`));
}

checkDepts().catch(console.error).finally(() => prisma.$disconnect());
