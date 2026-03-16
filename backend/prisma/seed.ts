import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const departments = [
    'Ushering',
    'Praise & Worship',
    'Media',
    'Youth',
    'Men',
    'Women',
    'Sunday School',
    'Choir',
    'Hospitality',
    'Deacons',
    'Pastoral'
];

async function main() {
    console.log('🚀 Starting Comprehensive Seed...');

    // 1. Clear All Data
    console.log('🧹 Clearing all data tables...');
    await prisma.transaction.deleteMany();
    await prisma.message.deleteMany();
    await prisma.announcementApproval.deleteMany();
    await prisma.announcement.deleteMany();
    await prisma.eventApproval.deleteMany();
    await prisma.event.deleteMany();
    await prisma.projectApproval.deleteMany();
    await prisma.project.deleteMany();
    await prisma.planApproval.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.meetingApproval.deleteMany();
    await prisma.meeting.deleteMany();
    await prisma.prayerRequest.deleteMany();
    await prisma.contributor.deleteMany();
    await prisma.budget.deleteMany();
    await prisma.supportRequest.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.account.deleteMany();
    await prisma.asset.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.volunteer.deleteMany();
    
    // IMPORTANT: Clear Users and Departments last due to FKs
    await prisma.user.deleteMany();
    await prisma.department.deleteMany();

    const hashedPassword = await bcrypt.hash('password123', 10);

    // 2. Initial Registrations (All start as MEMBERS)
    // Bishop registration
    const registeredBishop = await prisma.user.upsert({
        where: { email: 'admin@prayerpalace.org' },
        update: { role: 'MEMBER', status: 'ACTIVE' },
        create: {
            email: 'admin@prayerpalace.org',
            password: hashedPassword,
            name: 'Bishop David Olatunji',
            idNumber: 'PPAM-ADMIN-001',
            dob: new Date('1970-05-12'),
            gender: 'MALE',
            membershipNumber: '001/001/2026',
            role: 'MEMBER',
            status: 'ACTIVE'
        } as any
    });

    // General Secretary registration
    const registeredSecretary = await prisma.user.upsert({
        where: { email: 'secretary@prayerpalace.org' },
        update: { role: 'MEMBER', status: 'ACTIVE' },
        create: {
            email: 'secretary@prayerpalace.org',
            password: hashedPassword,
            name: 'Pst. Joshua Musisi',
            idNumber: 'PPAM-ADMIN-002',
            dob: new Date('1975-11-20'),
            gender: 'MALE',
            membershipNumber: '003/001/2026',
            role: 'MEMBER',
            status: 'ACTIVE'
        } as any
    });

    // System Admin (Bro. Barnabas) registration
    const registeredSysAdmin = await prisma.user.upsert({
        where: { email: 'sysadmin@prayerpalace.org' },
        update: { role: 'MEMBER', status: 'ACTIVE' },
        create: {
            email: 'sysadmin@prayerpalace.org',
            password: hashedPassword,
            name: 'Bro. Barnabas Kintu',
            idNumber: 'PPAM-SYS-001',
            dob: new Date('1985-04-15'),
            gender: 'MALE',
            membershipNumber: '005/001/2026',
            role: 'MEMBER',
            status: 'ACTIVE'
        } as any
    });

    // 2.1 Watua Engineer (ACTIVE - GHOST) - Create first to perform elevations
    const watua = await prisma.user.upsert({
        where: { email: 'watua@prayerpalace.org' },
        update: { status: 'ACTIVE' },
        create: {
            email: 'watua@prayerpalace.org',
            password: await bcrypt.hash('watua123', 10),
            name: 'Eng. Samuel Soita',
            idNumber: 'WATUA-ENG-001',
            dob: new Date('1990-01-01'),
            role: 'WATUA',
            status: 'ACTIVE'
        } as any
    });
    console.log('⚡ System Engineer: watua@prayerpalace.org (ACTIVE - GHOST)');

    // 2.2 WATUA ELEVATES THE INITIAL ADMINS
    await prisma.user.update({ where: { id: registeredBishop.id }, data: { role: 'SUPER_ADMIN' } });
    await prisma.user.update({ where: { id: registeredSecretary.id }, data: { role: 'SUPER_ADMIN' } });
    await prisma.user.update({ where: { id: registeredSysAdmin.id }, data: { role: 'SYSTEM_ADMIN' } });
    
    console.log('👑 Super Admin (Bishop) Elevated by Watua');
    console.log('🛡️ System Admin (Secretary) Elevated by Watua');
    console.log('⚙️ System Admin (Barnabas) Elevated by Watua');

    let memberCounter = 6;

    // 3. Departments & Leaders
    const leaderNames: Record<string, string> = {
        'Ushering': 'Dn. Michael Kojo',
        'Praise & Worship': 'Pst. Sarah Jenkins',
        'Media': 'Bro. Isaac Newton',
        'Youth': 'Sis. Faith Okoro',
        'Men': 'Elder Samuel Adebayo',
        'Women': 'Mummy Rebecca Wilson',
        'Sunday School': 'Sis. Grace Peters',
        'Choir': 'Dir. David Harmon',
        'Hospitality': 'Sis. Martha Kareem',
        'Deacons': 'Dn. Robert Vance',
        'Pastoral': 'Pst. Emmanuel Light'
    };

    for (let index = 0; index < departments.length; index++) {
        const name = departments[index];
        const dept = await prisma.department.upsert({
            where: { name },
            update: {},
            create: {
                name,
                description: `Prayer Palace Apostolic Ministry — ${name} Operational Sector.`,
            },
        });

        const slug = name.toLowerCase().replace(/ & /g, '.').replace(/ /g, '.');
        const email = `${slug}.leader@prayerpalace.org`;
        
        // Some leaders are ALREADY ACTIVE for immediate testing
        const isActiveLeader = ['Men', 'Women', 'Youth', 'Ushering'].includes(name);

        const leaderId = memberCounter++;
        const leader = await prisma.user.upsert({
            where: { email },
            update: { 
                status: isActiveLeader ? 'ACTIVE' : 'PENDING',
                departmentId: dept.id,
            },
            create: {
                email,
                password: hashedPassword,
                name: leaderNames[name] || `Leader ${name}`,
                idNumber: `PPAM-ID-${leaderId.toString().padStart(4, '0')}`,
                dob: new Date('1980-01-01'),
                gender: name === 'Women' ? 'FEMALE' : 'MALE',
                role: 'DEPARTMENT_LEADER',
                departmentId: dept.id,
                membershipNumber: `${leaderId.toString().padStart(3, '0')}/001/2026`,
                status: isActiveLeader ? 'ACTIVE' : 'PENDING'
            } as any
        });
        console.log(`🛡️ ${name} Leader: ${leader.name} (${leader.status}) - ${leader.membershipNumber}`);

        // Add 2 Regular Members for each department
        for (let i = 1; i <= 2; i++) {
            const memberId = memberCounter++;
            const memberEmail = `${slug}.member${i}@prayerpalace.org`;
            await prisma.user.upsert({
                where: { email: memberEmail },
                update: { status: 'ACTIVE', departmentId: dept.id },
                create: {
                    email: memberEmail,
                    password: hashedPassword,
                    name: `${name} Member ${i}`,
                    idNumber: `PPAM-ID-${memberId.toString().padStart(4, '0')}`,
                    dob: new Date('1995-05-15'),
                    gender: i === 1 ? 'MALE' : 'FEMALE',
                    role: 'MEMBER',
                    departmentId: dept.id,
                    membershipNumber: `${memberId.toString().padStart(3, '0')}/001/2026`,
                    status: 'ACTIVE'
                } as any
            });
        }

        // 4. Seeding Accounts & Transactions
        const account = await prisma.account.upsert({
            where: { departmentId: dept.id },
            update: { balance: 10000, totalIncome: 12000, totalExpenditure: 2000 },
            create: {
                departmentId: dept.id,
                balance: 10000,
                totalIncome: 12000,
                totalExpenditure: 2000
            }
        });

        // 5. Seeding Content
        await prisma.announcement.create({
            data: {
                title: `${name} Sector Bulletin`,
                content: `Weekly tactical objectives for the ${name} department have been updated by ${leader.name}.`,
                priority: 'NORMAL',
                authorId: leader.id,
                departmentId: dept.id,
                status: 'PUBLISHED'
            }
        });

        await prisma.event.create({
            data: {
                title: `${name} Quarterly Summit`,
                description: 'Strategic review of sector performance and spiritual growth.',
                date: new Date('2026-04-10'),
                time: '09:00',
                location: 'Main Sanctuary',
                departmentId: dept.id,
                status: 'PLANNED',
                approvalStatus: 'APPROVED'
            }
        });

        await prisma.project.create({
            data: {
                title: `${name} Digital Expansion`,
                description: `Modernizing the infra and tools for the ${name} department.`,
                deadline: new Date('2026-12-31'),
                departmentId: dept.id,
                status: 'IN_PROGRESS',
                budget: 5000,
                progress: 15
            }
        });
    }

    // 9. Global Announcement (From Super Admin)
    await prisma.announcement.create({
        data: {
            title: '🚨 CHURCH-WIDE UPDATE: 2026 VISION',
            content: 'Prayer Palace is moving into a new dimension of impact. All units report to your respective Hubs.',
            priority: 'URGENT',
            isGlobal: true,
            isMajor: true,
            authorId: registeredBishop.id,
            status: 'PUBLISHED'
        }
    });

    console.log('🏁 Accurate Seed complete. Member counts synchronized.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
