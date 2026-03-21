import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
    console.log('--- START VERIFICATION ---');
    
    // 1. Check Schema
    const userFields = Object.keys((prisma as any).user.fields);
    console.log('User has canManagePartnerships:', userFields.includes('canManagePartnerships'));

    // 2. Sample Data Test
    const users = await prisma.user.findMany({ take: 5 });
    console.log(`Found ${users.length} users.`);
    
    // 3. Test "Assigned Pastor" logic Simulation
    const pastor = users.find(u => u.role === 'PASTOR');
    if (pastor) {
        console.log(`Testing with Pastor: ${pastor.name}`);
        // Simulate what the controller does
        const isAdmin = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'WATUA'].includes(pastor.role);
        const isAssigned = pastor.role === 'PASTOR' && pastor.canManagePartnerships;
        const whereClause = (isAdmin || isAssigned) ? {} : { userId: pastor.id };
        
        console.log('Is Admin:', isAdmin);
        console.log('Is Assigned:', isAssigned);
        console.log('Where Clause:', JSON.stringify(whereClause));
    }

    console.log('--- END VERIFICATION ---');
}

verify().catch(console.error).finally(() => prisma.$disconnect());
