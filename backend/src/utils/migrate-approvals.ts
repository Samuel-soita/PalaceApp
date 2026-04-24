import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runMigration() {
    console.log('🚀 Starting Data Integrity Transition: Immediate-Deployment Migration');

    try {
        // 1. Announcements: PENDING -> PUBLISHED
        const announcements = await prisma.announcement.updateMany({
            where: { status: 'PENDING' },
            data: { status: 'PUBLISHED' }
        });
        console.log(`✅ Announcements migrated: ${announcements.count}`);

        // 2. Events: PENDING_APPROVAL -> APPROVED
        const events = await prisma.event.updateMany({
            where: { approvalStatus: 'PENDING_APPROVAL' },
            data: { approvalStatus: 'APPROVED' }
        });
        console.log(`✅ Events migrated: ${events.count}`);

        // 3. Meetings: PENDING_APPROVAL -> SCHEDULED
        const meetings = await prisma.meeting.updateMany({
            where: { meetingStatus: 'PENDING_APPROVAL' },
            data: { meetingStatus: 'SCHEDULED' }
        });
        console.log(`✅ Meetings migrated: ${meetings.count}`);

        // 4. Projects: PENDING_APPROVAL -> APPROVED
        const projects = await prisma.project.updateMany({
            where: { approvalStatus: 'PENDING_APPROVAL' },
            data: { approvalStatus: 'APPROVED' }
        });
        console.log(`✅ Projects migrated: ${projects.count}`);

        // 5. Plans: PENDING_APPROVAL -> APPROVED
        const plans = await prisma.plan.updateMany({
            where: { approvalStatus: 'PENDING_APPROVAL' },
            data: { approvalStatus: 'APPROVED' }
        });
        console.log(`✅ Plans migrated: ${plans.count}`);

        console.log('🏁 Migration completed successfully. All mission items are now deployed.');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

runMigration();
