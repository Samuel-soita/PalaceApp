import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  try {
    console.log('Testing dashboard queries...');
    // Simulated Bishop call (no effectiveDeptId, no userDeptId)
    const effectiveDeptId = null;
    const userDeptId = null;

    console.log('Testing account query...');
    const account = await (prisma as any).account.findUnique({ 
      where: { departmentId: effectiveDeptId || userDeptId || undefined } 
    });
    console.log('Account:', account);

    console.log('Testing transactions query...');
    const transactions = await (prisma as any).transaction.findMany({ 
      where: effectiveDeptId ? { account: { departmentId: effectiveDeptId } } : (userDeptId ? { account: { departmentId: userDeptId } } : {}),
      include: { approvals: true }
    });
    console.log('Transactions count:', transactions.length);
  } catch (err) {
    console.error('ERROR ENCOUNTERED:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
