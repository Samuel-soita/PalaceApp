import prisma from './utils/prisma.js';
async function test() {
    const leaderDeptId = 'test-dept-id'; // Assume something
    const timestamp = new Date(0);
    const result = await prisma.user.findMany({
        where: {
            AND: [
                { OR: [{ updatedAt: { gt: timestamp } }, { deletedAt: { gt: timestamp } }] },
                {
                    OR: [
                        leaderDeptId ? { departmentId: leaderDeptId } : {},
                        { role: { in: ['PASTOR', 'ASSOCIATE_PASTOR'] } }
                    ]
                }
            ]
        }
    });
    console.log(result.length, 'users found');
    console.log('Pastors in result:', result.filter(u => u.role === 'PASTOR' || u.role === 'ASSOCIATE_PASTOR').map(p => p.name));
}
test().catch(console.error).finally(() => prisma.$disconnect());
