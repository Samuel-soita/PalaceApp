import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 HARDENING MISSION STATUS: Bypassing all legacy approval gates...');

    // 1. PROJECTS
    const projects = await prisma.project.updateMany({
        where: { approvalStatus: { not: 'APPROVED' } },
        data: { approvalStatus: 'APPROVED' }
    });
    console.log(`✅ Activated ${projects.count} projects.`);

    // 2. EVENTS
    const events = await prisma.event.updateMany({
        where: { approvalStatus: { not: 'APPROVED' } },
        data: { approvalStatus: 'APPROVED' }
    });
    console.log(`✅ Activated ${events.count} events.`);

    // 3. PLANS
    const plans = await prisma.plan.updateMany({
        where: { approvalStatus: { not: 'APPROVED' } },
        data: { approvalStatus: 'APPROVED' }
    });
    console.log(`✅ Activated ${plans.count} plans.`);

    // 4. MEETINGS
    const meetings = await prisma.meeting.updateMany({
        where: { meetingStatus: { not: 'SCHEDULED' } },
        data: { meetingStatus: 'SCHEDULED' }
    });
    console.log(`✅ Activated ${meetings.count} meetings.`);

    // 5. ANNOUNCEMENTS
    const announcements = await prisma.announcement.updateMany({
        where: { status: { not: 'PUBLISHED' } },
        data: { status: 'PUBLISHED' }
    });
    console.log(`✅ Activated ${announcements.count} announcements.`);

    console.log('🏁 HARDENING COMPLETE: All mission items are now live.');
}

main()
    .catch(e => {
        console.error('❌ Migration failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
