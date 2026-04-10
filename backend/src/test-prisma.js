const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function test() {
    const timestamp = new Date(0);
    const result = await prisma.user.findMany({
        where: {
            AND: [
                { OR: [{ updatedAt: { gt: timestamp } }, { deletedAt: { gt: timestamp } }] },
                {
                    OR: [
                        { departmentId: 'abcd' },
                        { role: { in: ['PASTOR', 'ASSOCIATE_PASTOR'] } }
                    ]
                }
            ]
        }
    });
    console.log(result.length, 'users found');
    console.log('Pastors:', result.filter(u => u.role === 'PASTOR' || u.role === 'ASSOCIATE_PASTOR').map(p => p.name));
}
test().finally(() => prisma.$disconnect());
