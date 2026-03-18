import prisma from './src/utils/prisma.js';

async function main() {
  try {
    console.log('Testing Prisma connection...');
    const userCount = await prisma.user.count();
    console.log('User count:', userCount);
    
    const devotionCount = await (prisma as any).devotion.count();
    console.log('Devotion count:', devotionCount);
    
    const devotion = await (prisma as any).devotion.findFirst();
    console.log('First devotion:', devotion ? 'Found' : 'Not found');

    if (devotion) {
        console.log('Devotion title:', devotion.title);
    }
  } catch (error) {
    console.error('Prisma Test Failed:');
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
