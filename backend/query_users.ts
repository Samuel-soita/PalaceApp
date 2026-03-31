import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    take: 30,
    orderBy: { role: 'asc' },
    select: {
      name: true,
      membershipNumber: true,
      role: true,
      department: { select: { name: true } },
      status: true
    }
  });
  console.log(JSON.stringify(users, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
