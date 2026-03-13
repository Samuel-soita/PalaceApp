import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting comprehensive seed...');
    const pw = await bcrypt.hash('password123', 10);

    // ─── DEPARTMENTS ──────────────────────────────────────────────
    const deptNames = [
        'Pastoral', 'Youth', 'Choir', 'Media', 'Women',
        'Men', 'Deacons', 'Sunday School', 'Hospitality', 'Praise & Worship'
    ];
    for (const name of deptNames) {
        await prisma.department.upsert({
            where: { name },
            update: {},
            create: { name, description: `${name} department of Palace Hub Church` }
        });
    }
    console.log('✅ Departments ready');

    const depts = await prisma.department.findMany();
    const deptMap = Object.fromEntries(depts.map(d => [d.name, d.id]));

    // ─── KEY USERS ────────────────────────────────────────────────
    // Bishop (SUPER_ADMIN)
    const bishop = await prisma.user.upsert({
        where: { email: 'bishop@palacehub.com' },
        update: {},
        create: { email: 'bishop@palacehub.com', password: pw, name: 'Bishop Samuel Osei', role: 'SUPER_ADMIN' }
    });

    // 2 Pastors (PASTOR role — needed for announcement multi-sig)
    const pastor1 = await prisma.user.upsert({
        where: { email: 'pastor.james@palacehub.com' },
        update: {},
        create: { email: 'pastor.james@palacehub.com', password: pw, name: 'Pastor James Maina', role: 'PASTOR' }
    });
    const pastor2 = await prisma.user.upsert({
        where: { email: 'pastor.grace@palacehub.com' },
        update: {},
        create: { email: 'pastor.grace@palacehub.com', password: pw, name: 'Pastor Grace Wanjiku', role: 'PASTOR' }
    });

    // Department Leaders
    const leaderData = [
        { email: 'leader.pastoral@palacehub.com', name: 'Rev. Daniel Kiprop', dept: 'Pastoral' },
        { email: 'leader.youth@palacehub.com', name: 'Bro. Kevin Otieno', dept: 'Youth' },
        { email: 'leader.choir@palacehub.com', name: 'Sis. Mary Akinyi', dept: 'Choir' },
        { email: 'leader.media@palacehub.com', name: 'Bro. Peter Kamau', dept: 'Media' },
        { email: 'leader.women@palacehub.com', name: 'Sis. Agnes Njeri', dept: 'Women' },
        { email: 'leader.men@palacehub.com', name: 'Bro. John Mugo', dept: 'Men' },
        { email: 'leader.deacons@palacehub.com', name: 'Dea. Paul Kariuki', dept: 'Deacons' },
        { email: 'leader.sunday@palacehub.com', name: 'Sis. Ruth Wambua', dept: 'Sunday School' },
        { email: 'leader.hospitality@palacehub.com', name: 'Bro. Samuel Nganga', dept: 'Hospitality' },
        { email: 'leader.pw@palacehub.com', name: 'Sis. Faith Muthoni', dept: 'Praise & Worship' },
    ];
    const leaderMap = {};
    for (const l of leaderData) {
        const leader = await prisma.user.upsert({
            where: { email: l.email },
            update: { departmentId: deptMap[l.dept] },
            create: { email: l.email, password: pw, name: l.name, role: 'DEPARTMENT_LEADER', departmentId: deptMap[l.dept] }
        });
        leaderMap[l.dept] = leader;
    }
    console.log('✅ Users ready (Bishop, 2 Pastors, 10 Leaders)');

    // ─── CLEAR OLD DATA ───────────────────────────────────────────
    await prisma.notification.deleteMany();
    await prisma.supportRequest.deleteMany();
    await prisma.announcementApproval.deleteMany();
    await prisma.announcement.deleteMany();
    await prisma.meetingApproval.deleteMany();
    await prisma.meeting.deleteMany();
    await prisma.projectUpdate.deleteMany();
    await prisma.project.deleteMany();
    await prisma.event.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.contributor.deleteMany();
    await prisma.budget.deleteMany();
    console.log('🗑️  Old data cleared');

    // ─── EVENTS ───────────────────────────────────────────────────
    const events = await prisma.event.createManyAndReturn({
        data: [
            {
                title: 'Easter Sunday Service',
                date: new Date('2026-04-05'), time: '09:00',
                location: 'Main Sanctuary',
                departmentId: deptMap['Pastoral'],
                description: 'Annual Easter celebration service.',
                eventType: 'SERVICE', budgetNeeded: 8000, volunteersNeeded: 20,
                approvalStatus: 'APPROVED', status: 'PLANNED'
            },
            {
                title: 'Youth Crossover Night',
                date: new Date('2026-03-21'), time: '18:30',
                location: 'Youth Hall', departmentId: deptMap['Youth'],
                description: 'New year crossover night for the youth.',
                eventType: 'DEPARTMENT_EVENT', budgetNeeded: 5000, volunteersNeeded: 10,
                approvalStatus: 'PENDING_APPROVAL', status: 'PLANNED'
            },
            {
                title: 'Choir Rehearsal & Showcase',
                date: new Date('2026-03-22'), time: '14:00',
                location: 'Music Room', departmentId: deptMap['Choir'],
                description: 'Pre-Easter choir rehearsal and musical showcase.',
                eventType: 'DEPARTMENT_EVENT', budgetNeeded: 2000, volunteersNeeded: 5,
                approvalStatus: 'APPROVED', status: 'PLANNED'
            },
            {
                title: 'Women\'s Conference 2026',
                date: new Date('2026-04-12'), time: '08:00',
                location: 'Conference Hall', departmentId: deptMap['Women'],
                description: 'Annual gathering for women\'s ministry.',
                eventType: 'CONFERENCE', budgetNeeded: 15000, volunteersNeeded: 30,
                approvalStatus: 'PENDING_APPROVAL', status: 'PLANNED'
            },
            {
                title: 'Sunday School Awards Day',
                date: new Date('2026-03-29'), time: '10:30',
                location: 'Children\'s Wing', departmentId: deptMap['Sunday School'],
                description: 'Awards giving ceremony for outstanding children.',
                eventType: 'DEPARTMENT_EVENT', budgetNeeded: 3000, volunteersNeeded: 8,
                approvalStatus: 'APPROVED', status: 'PLANNED'
            }
        ]
    });
    console.log('✅ Events seeded');

    // ─── PROJECTS ─────────────────────────────────────────────────
    await prisma.project.createMany({
        data: [
            {
                title: 'Church Website Redesign',
                description: 'Redesign the Palace Hub website to be mobile-first and modern.',
                departmentId: deptMap['Media'],
                deadline: new Date('2026-03-25'), budget: 10000,
                progress: 60, status: 'ONGOING'
            },
            {
                title: 'Youth Drama Ministry',
                description: 'Create a drama team for gospel outreach through creative arts.',
                departmentId: deptMap['Youth'],
                deadline: new Date('2026-04-10'), budget: 4000,
                progress: 30, status: 'PLANNED'
            },
            {
                title: 'Hospitality Welcome Kits',
                description: '500 welcome packs for all new members and visitors every Sunday.',
                departmentId: deptMap['Hospitality'],
                deadline: new Date('2026-03-21'), budget: 1500,
                progress: 80, status: 'ONGOING'
            },
            {
                title: 'Audio System Overhaul',
                description: 'Replace aging PA system with a professional 24-channel digital mixer.',
                departmentId: deptMap['Media'],
                deadline: new Date('2026-04-30'), budget: 85000,
                progress: 15, status: 'PLANNED'
            },
            {
                title: 'Annual Leadership Retreat',
                description: 'Two-day off-site retreat for all department leaders and elders.',
                departmentId: deptMap['Deacons'],
                deadline: new Date('2026-04-18'), budget: 25000,
                progress: 10, status: 'PLANNED'
            }
        ]
    });
    console.log('✅ Projects seeded');

    // ─── PLANS ────────────────────────────────────────────────────
    await prisma.plan.createMany({
        data: [
            {
                title: 'Q2 2026 Evangelism Drive',
                description: 'Door-to-door evangelism in Westlands and Kasarani targeting 2,000 homes.',
                type: 'MONTHLY', departmentId: deptMap['Pastoral'],
                approvalStatus: 'APPROVED'
            },
            {
                title: 'Youth Annual Sports Day',
                description: 'Inter-church football and athletics tournament for youth aged 13–25.',
                type: 'YEARLY', departmentId: deptMap['Youth'],
                approvalStatus: 'PENDING_APPROVAL'
            },
            {
                title: 'Choir Christmas Album',
                description: 'Record and distribute a Christmas praise album before December 2026.',
                type: 'YEARLY', departmentId: deptMap['Choir'],
                approvalStatus: 'PENDING_APPROVAL'
            },
            {
                title: 'Women\'s Monthly Prayer Breakfast',
                description: 'First Saturday of every month: prayer, word, and fellowship 7–9am.',
                type: 'MONTHLY', departmentId: deptMap['Women'],
                approvalStatus: 'APPROVED'
            },
            {
                title: 'Media Livestream Launch',
                description: 'Set up YouTube and Facebook live streaming for Sunday services.',
                type: 'MONTHLY', departmentId: deptMap['Media'],
                approvalStatus: 'APPROVED'
            }
        ]
    });
    console.log('✅ Plans seeded');

    // ─── BUDGETS ─────────────────────────────────────────────────
    await prisma.budget.createMany({
        data: [
            {
                title: 'Easter Service Budget', targetAmount: 8000, amountRaised: 5500,
                deadline: new Date('2026-03-30'), status: 'OPEN',
                departmentId: deptMap['Pastoral'], isGlobal: false
            },
            {
                title: 'Church Monthly Budget — March 2026',
                targetAmount: 120000, amountRaised: 78000,
                deadline: new Date('2026-03-31'), status: 'OPEN',
                isGlobal: true
            },
            {
                title: 'Women\'s Conference Fund', targetAmount: 15000, amountRaised: 9000,
                deadline: new Date('2026-04-10'), status: 'OPEN',
                departmentId: deptMap['Women'], isGlobal: false
            },
            {
                title: 'Audio System Fund', targetAmount: 85000, amountRaised: 12000,
                deadline: new Date('2026-04-20'), status: 'OPEN',
                departmentId: deptMap['Media'], isGlobal: false
            }
        ]
    });
    console.log('✅ Budgets seeded');

    // ─── ANNOUNCEMENTS ────────────────────────────────────────────
    // Auto-published by Bishop (no approval needed when SUPER_ADMIN creates)
    const globalAnn1 = await prisma.announcement.create({
        data: {
            title: '🔥 All-Church Fasting Week',
            content: 'The entire Palace Hub family is called to a corporate fast from 13–17 March. Daily prayer at 6am and 6pm at the Main Sanctuary.',
            priority: 'HIGH',
            isGlobal: true,
            status: 'PUBLISHED',
            authorId: bishop.id
        }
    });
    const globalAnn2 = await prisma.announcement.create({
        data: {
            title: '📅 Easter Schedule Released',
            content: 'Good Friday service: April 3 @ 10am. Easter Sunday: April 5 @ 9am (Main Sanctuary). All departments must submit volunteer lists by March 30.',
            priority: 'HIGH',
            isGlobal: true,
            status: 'PUBLISHED',
            authorId: bishop.id
        }
    });
    // A pending announcement requiring multi-sig approval
    const pendingAnn = await prisma.announcement.create({
        data: {
            title: '🏡 Church Building Fund Drive',
            content: 'The Women\'s department is launching a special building fund drive. All members are encouraged to contribute KES 500 towards the new church building.',
            priority: 'NORMAL',
            isGlobal: true,
            status: 'PENDING',
            authorId: leaderMap['Women'].id,
            departmentId: deptMap['Women']
        }
    });
    // Bishop has signed the pending one but 2 pastors haven't yet (shows workflow in progress)
    await prisma.announcementApproval.create({
        data: { announcementId: pendingAnn.id, userId: bishop.id, role: 'BISHOP' }
    });
    await prisma.announcementApproval.create({
        data: { announcementId: pendingAnn.id, userId: pastor1.id, role: 'PASTOR' }
    });
    // Dept-specific announcement (no approval needed)
    await prisma.announcement.create({
        data: {
            title: '🎵 Choir Auditions Open',
            content: 'The Choir department is holding auditions this Saturday at 3pm in the Music Room. All voice types welcome!',
            priority: 'NORMAL',
            isGlobal: false,
            status: 'PUBLISHED',
            authorId: leaderMap['Choir'].id,
            departmentId: deptMap['Choir']
        }
    });
    console.log('✅ Announcements seeded (2 published global, 1 pending [1/3 approved], 1 dept-specific)');

    // ─── SUPPORT REQUESTS ─────────────────────────────────────────
    // Tiny base64 green proof image (1x1px PNG)
    const dummyProof = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    await prisma.supportRequest.createMany({
        data: [
            {
                title: 'Youth Crossover Night — Sound & Lights',
                description: 'Requesting support for professional sound equipment and lighting rig for the Youth Crossover Night on March 21.',
                amountRequired: 1500,
                proofImageUrl: dummyProof,
                status: 'OPEN',
                eventId: events[1].id, // Youth Crossover Night
                requesterId: leaderMap['Youth'].id
            },
            {
                title: 'Women\'s Conference — Venue Setup',
                description: 'Need support for chairs, tables, banners, and catering for the Women\'s Conference April 12.',
                amountRequired: 1500,
                proofImageUrl: dummyProof,
                status: 'FUNDED',
                eventId: events[3].id, // Women's Conference
                requesterId: leaderMap['Women'].id
            }
        ]
    });
    console.log('✅ Support Requests seeded');

    // ─── MEETINGS ─────────────────────────────────────────────────
    const meetingArr = await prisma.meeting.createManyAndReturn({
        data: [
            {
                title: 'March Leadership Sync',
                departmentId: deptMap['Pastoral'], date: new Date('2026-03-20'),
                time: '10:00', venue: 'Boardroom A', meetingType: 'PLANNING',
                agenda: 'Review Q1 performance, plan Easter Sunday logistics, budget allocation approval.',
                organizerId: leaderMap['Pastoral'].id, meetingStatus: 'SCHEDULED'
            },
            {
                title: 'Youth Department Monthly Review',
                departmentId: deptMap['Youth'], date: new Date('2026-03-18'),
                time: '17:00', venue: 'Youth Hall', meetingType: 'REVIEW',
                agenda: 'Crossover Night final check, membership update, drama ministry launch.',
                organizerId: leaderMap['Youth'].id, meetingStatus: 'PENDING_APPROVAL'
            }
        ]
    });

    // Add approvals for the first meeting
    await prisma.meetingApproval.createMany({
        data: [
            { meetingId: meetingArr[0].id, userId: bishop.id, role: 'BISHOP', approved: true },
            { meetingId: meetingArr[0].id, userId: leaderMap['Pastoral'].id, role: 'DEPARTMENT_LEADER', approved: true }
        ]
    });
    console.log('✅ Meetings seeded');

    // ─── NOTIFICATIONS ────────────────────────────────────────────
    await prisma.notification.createMany({
        data: [
            {
                userId: bishop.id,
                title: '✋ Event Awaiting Approval',
                message: 'Youth Crossover Night by Bro. Kevin Otieno requires your authorization.'
            },
            {
                userId: bishop.id,
                title: '✋ Event Awaiting Approval',
                message: 'Women\'s Conference 2026 by Sis. Agnes Njeri requires your authorization.'
            },
            {
                userId: bishop.id,
                title: '📢 Announcement Awaiting Your Signature',
                message: 'Church Building Fund Drive needs your signature (1/3 approvals received).'
            },
            {
                userId: pastor2.id,
                title: '📢 Announcement Awaiting Your Signature',
                message: 'Church Building Fund Drive needs your signature (1/3 approvals received).'
            },
            {
                userId: leaderMap['Youth'].id,
                title: '🤝 Support Request Viewed',
                message: 'Your support request for the Crossover Night has been seen by all department heads.'
            },
            {
                userId: leaderMap['Women'].id,
                title: '✅ Support Request Funded',
                message: 'Your Women\'s Conference support request has been funded by the church!'
            }
        ]
    });
    console.log('✅ Notifications seeded');

    console.log('\n🏁 ═══════════════════════════════════════════════════');
    console.log('   Palace Hub — Full Demo Seed Complete!');
    console.log('═════════════════════════════════════════════════════');
    console.log('   Bishop:   bishop@palacehub.com / password123');
    console.log('   Pastor 1: pastor.james@palacehub.com / password123');
    console.log('   Pastor 2: pastor.grace@palacehub.com / password123');
    console.log('   Leader:   leader.youth@palacehub.com / password123');
    console.log('   Leader:   leader.media@palacehub.com / password123');
    console.log('═════════════════════════════════════════════════════\n');
}

main()
    .catch((e) => { console.error('❌ Seed error:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
