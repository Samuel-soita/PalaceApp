import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function count() {
    console.log('Projects:', await prisma.project.count());
    console.log('Events:', await prisma.event.count());
    console.log('Announcements:', await prisma.announcement.count());
    console.log('Meetings:', await prisma.meeting.count());
    console.log('Plans:', await prisma.plan.count());
    
    console.log('Projects APPROVED:', await prisma.project.count({ where: { approvalStatus: 'APPROVED' } }));
    console.log('Announcements PUBLISHED:', await prisma.announcement.count({ where: { status: 'PUBLISHED' } }));
    console.log('Meetings SCHEDULED:', await prisma.meeting.count({ where: { meetingStatus: 'SCHEDULED' } }));
    
    await prisma.$disconnect();
}
count();
