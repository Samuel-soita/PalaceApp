import prisma from './prisma.js';
import crypto from 'crypto';

async function seedGlobalData() {
    console.log('🚀 Initiating Authentic Global Architecture Seeding...');

    // Clear existing critical data for a clean slate using TRUNCATE CASCADE
    console.log('🧹 Purging all tables with TRUNCATE CASCADE...');
    await prisma.$executeRawUnsafe(`
        TRUNCATE TABLE 
            "WatuaActionLog", "AuditLog", "Session", "PermissionOverride", "Notification",
            "AnnouncementApproval", "MeetingApproval", "ProjectApproval", "EventApproval", "PlanApproval",
            "SupportRequest", "Message", "PartnershipLedger", "Partnership",
            "Transaction", "Account",
            "ProjectUpdate", "Project", "Event", "Meeting", "Plan", "Announcement",
            "DevotionInteraction", "Devotion", "Affirmation",
            "Child", "Baptism", "Appointment", "Volunteer",
            "RolePermission", "Permission", "Role",
            "_DeptManagers", "User", "Department"
        CASCADE
    `);

    // 1. Departments Network
    console.log('📦 Establishing Hubs & Departments...');
    const depts = await Promise.all([
        (prisma.department as any).create({ data: { name: 'Men of Valor', description: 'Empowering men for Kingdom leadership.' } }),
        (prisma.department as any).create({ data: { name: 'Women of Grace', description: 'Nurturing women in faith, family, and enterprise.' } }),
        (prisma.department as any).create({ data: { name: 'NextGen Youth', description: 'Equipping the next generation of revivalists.' } }),
        (prisma.department as any).create({ data: { name: 'Kingdom Kids', description: 'Laying the spiritual foundation for children.' } }),
        (prisma.department as any).create({ data: { name: 'Worship Arts', description: 'Leading the congregation in transformative worship.' } })
    ]);

    // 2. Authentic Leadership Personas
    console.log('👑 Ordaining Leadership Core...');
    const superAdmin = await prisma.user.create({
        data: { name: "Bishop Emmanuel Mworia", idNumber: "12345678", membershipNumber: "001/001/2026", phoneNumber: "0711123456", dob: new Date("1965-05-15"), gender: "MALE", role: "SUPER_ADMIN", status: "ACTIVE", profilePhoto: "https://i.pravatar.cc/150?u=bishop", isCardPaid: true, isPartner: true }
    });

    const pastor = await prisma.user.create({
        data: { name: "Pastor Joshua Kariuki", idNumber: "23456789", membershipNumber: "002/001/2026", phoneNumber: "0722234567", dob: new Date("1978-08-20"), gender: "MALE", role: "PASTOR", status: "ACTIVE", isCardPaid: true, isPartner: true }
    });

    const secretary = await prisma.user.create({
        data: { name: "Jane Wanjiku (Secretariat)", idNumber: "34567890", membershipNumber: "003/001/2026", phoneNumber: "0733345678", dob: new Date("1985-11-05"), gender: "FEMALE", role: "SECRETARY", status: "ACTIVE", isCardPaid: true }
    });

    const watuaEngineer = await prisma.user.create({
        data: { name: "System Kernel (WATUA)", idNumber: "99999999", membershipNumber: "999/001/2026", phoneNumber: "0799999999", dob: new Date("1990-01-01"), gender: "MALE", role: "WATUA", status: "ACTIVE" }
    });

    const systemAdmin = await prisma.user.create({
        data: { name: "David Ochieng (Admin)", idNumber: "45678901", membershipNumber: "004/001/2026", phoneNumber: "0744456789", dob: new Date("1982-03-12"), gender: "MALE", role: "SYSTEM_ADMIN", status: "ACTIVE", departmentId: depts[4].id, isCardPaid: true }
    });

    const leaders = await Promise.all([
        prisma.user.create({ data: { name: "Deacon John Mutua", idNumber: "56789012", membershipNumber: "005/001/2026", phoneNumber: "0755567890", dob: new Date("1975-06-25"), gender: "MALE", role: "DEPARTMENT_LEADER", status: "ACTIVE", departmentId: depts[0].id, isCardPaid: true } }),
        prisma.user.create({ data: { name: "Deaconess Mary Njeri", idNumber: "67890123", membershipNumber: "006/001/2026", phoneNumber: "0766678901", dob: new Date("1980-09-14"), gender: "FEMALE", role: "DEPARTMENT_LEADER", status: "ACTIVE", departmentId: depts[1].id, isCardPaid: true } }),
        prisma.user.create({ data: { name: "Brother Kevin Omondi", idNumber: "78901234", membershipNumber: "007/001/2026", phoneNumber: "0777789012", dob: new Date("1995-12-03"), gender: "MALE", role: "DEPARTMENT_LEADER", status: "ACTIVE", departmentId: depts[2].id, isCardPaid: true } }),
    ]);

    // Update Dept Leaders
    await (prisma.department as any).update({ where: { id: depts[0].id }, data: { leaderId: leaders[0].id } });
    await (prisma.department as any).update({ where: { id: depts[1].id }, data: { leaderId: leaders[1].id } });
    await (prisma.department as any).update({ where: { id: depts[2].id }, data: { leaderId: leaders[2].id } });

    // 3. Diverse Active Congregation
    console.log('👥 Registering Covenant Members...');
    const members = [];
    const firstNamesM = ["James", "Peter", "Daniel", "Michael", "Joseph", "Samuel", "Isaac", "Felix", "Vincent", "Brian"];
    const firstNamesF = ["Sarah", "Grace", "Faith", "Joy", "Esther", "Ruth", "Naomi", "Lydia", "Mercy", "Gladys"];
    const lastNames = ["Kamau", "Ochieng", "Kiprop", "Wamalwa", "Mutisya", "Onyango", "Waithera", "Njoroge", "Muthoni", "Kipkemboi"];

    for (let i = 1; i <= 30; i++) {
        const isMale = i % 2 !== 0;
        const firstName = isMale ? firstNamesM[i % 10] : firstNamesF[i % 10];
        const lastName = lastNames[(i * 3) % 10];
        const deptIndex = isMale ? (i % 2 === 0 ? 2 : 0) : (i % 2 === 0 ? 2 : 1); // Distribute Men/Youth, Women/Youth

        const year = 1970 + (i % 30);
        const month = (i % 12) + 1;
        const day = (i % 28) + 1;

        const status = i === 29 ? "PENDING" : (i === 30 ? "SUSPENDED" : "ACTIVE");
        const isPaid = i % 4 !== 0; // 75% have paid for ID card
        
        const member = await prisma.user.create({
            data: {
                name: `${firstName} ${lastName}`,
                idNumber: `2000${i.toString().padStart(4, '0')}`,
                membershipNumber: `100/${i.toString().padStart(3, '0')}/2026`,
                phoneNumber: `0788${i.toString().padStart(6, '0')}`,
                dob: new Date(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`),
                gender: isMale ? "MALE" : "FEMALE",
                role: "MEMBER",
                status: status,
                departmentId: depts[deptIndex].id,
                isCardPaid: isPaid,
                isPartner: i <= 15,
                createdAt: new Date(Date.now() - (i * 86400000)) // Stagger creation dates
            }
        });
        members.push(member);
    }

    // 4. Financial Ecosystem (Partnerships & Real Ledgers)
    console.log('💰 Establishing Financial Ecosystem (Tithes, Pledges)...');
    for (let i = 0; i < 15; i++) {
        const m = members[i];
        const totalAmount = (i % 3 === 0) ? 100000 : 50000;
        const paidAmount = (i % 2 === 0) ? totalAmount * 0.4 : totalAmount * 0.8;
        
        const p = await prisma.partnership.create({
            data: {
                userId: m.id,
                amount: totalAmount, 
                paidAmount: paidAmount,
                balance: totalAmount - paidAmount,
                status: 'ACTIVE',
                frequency: i % 2 === 0 ? 'MONTHLY' : 'WEEKLY'
            }
        });

        // Seed 2-3 historical ledger transactions per partnership to populate Mission Analytics
        const txns = [
            { amount: paidAmount * 0.4, method: 'MPESA', ref: `MP${i}A` },
            { amount: paidAmount * 0.6, method: 'BANK', ref: `BK${i}B` }
        ];

        for (const [index, txn] of txns.entries()) {
            await (prisma as any).partnershipLedger.create({
                data: {
                    partnershipId: p.id,
                    amount: txn.amount,
                    transactionType: 'CREDIT',
                    paymentMethod: txn.method,
                    referenceCode: `${txn.ref}-${crypto.randomUUID().substring(0, 4)}`,
                    status: 'VERIFIED',
                    date: new Date(Date.now() - ((index + 1) * 7 * 86400000)) // Last couple of weeks
                }
            });
        }
    }

    // 5. Workflows (Baptisms & Child Dedications)
    console.log('🕊️ Populating Spiritual Workflows & Sacraments...');
    await Promise.all([
        prisma.baptism.create({ data: { userId: members[5].id, status: 'APPROVED', plannedDate: new Date('2026-05-01'), notes: 'Completed fundamental classes.' } }),
        prisma.baptism.create({ data: { userId: members[15].id, status: 'PENDING_PASTOR_APPROVAL', plannedDate: new Date('2026-06-15'), notes: 'Needs pastor interview.' } }),
        prisma.child.create({ data: { parentId: members[2].id, name: 'David Kamau Jr.', dob: new Date('2025-01-10'), gender: 'MALE', workflowStatus: 'PENDING_DEDICATION', branch: 'HQ' } })
    ]);

    // 6. Projects & Events
    console.log('🏛️ Scheduling Events and Capital Projects...');
    await prisma.event.createMany({
        data: [
            { title: 'Global Kingdom Expansion Summit', description: 'Annual international conference gathering thousands of believers for teaching and impartation.', date: new Date('2026-08-15'), time: '09:00', departmentId: depts[0].id, location: 'Main Sanctuary', isMajor: true, status: 'CONFIRMED' },
            { title: 'Youth Flame Retreat', description: 'A weekend fire retreat for high school and university students focusing on purity and purpose.', date: new Date(Date.now() + 14 * 86400000), time: '14:00', departmentId: depts[2].id, location: 'Camp David, Naivasha', status: 'PLANNED' },
            { title: 'Women of Grace Business Breakfast', description: 'Empowering women in the marketplace. Guest speaker: Dr. Rebecca.', date: new Date(Date.now() + 7 * 86400000), time: '07:30', departmentId: depts[1].id, location: 'Hotel Intercontinental', status: 'CONFIRMED' }
        ]
    });

    const project = await prisma.project.create({
        data: {
            title: 'Operation Nehemiah: Sanctuary Expansion',
            description: 'Phase 2: Building the new 5,000-seater auditorium wing and children\'s church complex.',
            budget: 50000000, // 50M
            progress: 35,
            status: 'ACTIVE',
            departmentId: depts[0].id,
            isMajor: true,
            approvalStatus: 'APPROVED'
        }
    });

    await prisma.projectUpdate.createMany({
         data: [
             { projectId: project.id, message: 'Foundation stone laid successfully. Phase 1 structural integrity approved.', date: new Date(Date.now() - 30 * 86400000) },
             { projectId: project.id, message: 'Roofing trusses delivered on site. Contractor mobilizing crane.', date: new Date(Date.now() - 2 * 86400000) }
         ]
    });

    // 7. Security Audit & Watua Telemetry
    console.log('🛡️ Generating System Telemetry & Audits...');
    const auditEvents = [
        { actorId: pastor.id, role: 'PASTOR', action: 'APPROVE_BAPTISM', entity: 'BAPTISM', target: members[5].id },
        { actorId: superAdmin.id, role: 'SUPER_ADMIN', action: 'UPDATE_ROLE', entity: 'USER', target: leaders[2].id },
        { actorId: secretary.id, role: 'SECRETARY', action: 'MARK_CARD_PAID', entity: 'USER', target: members[25].id }
    ];

    for (const [index, audit] of auditEvents.entries()) {
        await (prisma as any).auditLog.create({
            data: {
                actorId: audit.actorId,
                actorRole: audit.role,
                actionType: audit.action,
                entityType: audit.entity,
                entityId: audit.target,
                createdAt: new Date(Date.now() - (index * 3600000))
            }
        });
    }

    await (prisma as any).watuaActionLog.create({
        data: {
            engineerId: watuaEngineer.id,
            actionType: 'FORCE_AUTH_REVOKE',
            targetEntity: members[29].id,
            executed: true,
            createdAt: new Date(Date.now() - 86400000)
        }
    });

    // Generate recent heartbeat trends for Watua Analytics
    for(let i=1; i<=7; i++) {
         await (prisma as any).auditLog.create({
            data: {
                actorId: watuaEngineer.id,
                actorRole: 'WATUA',
                actionType: 'SYSTEM_HEARTBEAT',
                entityType: 'KERNEL',
                createdAt: new Date(Date.now() - (i * 86400000))
            }
        });
    }

    // 8. System Configuration
    console.log('⚙️ Initializing System Configuration...');
    await prisma.ministrySettings.upsert({
        where: { id: 'GLOBAL' },
        update: {},
        create: {
            id: 'GLOBAL',
            themeOfYear: 'YEAR OF DIVINE ESTABLISHMENT',
            themeOfMonth: 'SEASON OF COVENANT RENEWAL',
            churchBudget: 5000000
        }
    });

    // Seed core feature flags
    const flags = [
        { name: 'PARTNER_PORTAL', enabled: true, scope: 'GLOBAL' },
        { name: 'WATUA_TERMINAL', enabled: true, scope: 'ROLE:WATUA' },
        { name: 'APPOINTMENTS', enabled: true, scope: 'GLOBAL' },
        { name: 'BROADCAST_ANNOUNCEMENTS', enabled: true, scope: 'GLOBAL' },
        { name: 'CHILD_DEDICATION', enabled: true, scope: 'GLOBAL' },
    ];
    for (const flag of flags) {
        await (prisma as any).featureFlag.upsert({
            where: { name: flag.name },
            update: { enabled: flag.enabled, scope: flag.scope },
            create: { name: flag.name, enabled: flag.enabled, scope: flag.scope }
        });
    }

    console.log('✅ ESTABLISHMENT SUCCESSFUL: Authentic Architectural Seeding Complete.');
}

seedGlobalData()
    .catch((e) => {
        console.error('Fatal Seed Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
