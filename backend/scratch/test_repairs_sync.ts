import prisma from './src/utils/prisma.js';

async function testSync() {
    try {
        const timestamp = new Date("2026-04-08T19:05:38.891Z");
        const result = await prisma.technicalRepair.findMany({
            where: {
                OR: [{ updatedAt: { gt: timestamp } }, { deletedAt: { gt: timestamp } }]
            },
            include: { department: true, requester: true, approvals: { include: { user: true } } },
            orderBy: { updatedAt: 'desc' }
        });
        console.log("Success! Count:", result.length);
    } catch (err) {
        console.error("FAILURE:", err);
    } finally {
        await prisma.$disconnect();
    }
}

testSync();
