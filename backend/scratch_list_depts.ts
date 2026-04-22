import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const departments = await prisma.department.findMany({
    select: { id: true, name: true }
  });
  console.log('Departments:', JSON.stringify(departments, null, 2));
  console.log('Total Departments:', departments.length);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
