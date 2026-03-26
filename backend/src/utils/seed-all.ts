import prisma from './prisma.js';
import crypto from 'crypto';

async function seedGlobalData() {
    console.log('🚀 INITIATING MONOLITHIC 2.0 EXHAUSTIVE SEEDING...');

    // Clear existing data (REVERSED FK order)
    console.log('🧹 Purging all tables with TRUNCATE CASCADE...');
    await prisma.$executeRawUnsafe(`
        TRUNCATE TABLE 
            "WatuaActionLog", "AuditLog", "Session", "PermissionOverride", "Notification",
            "AnnouncementApproval", "MeetingApproval", "ProjectApproval", "EventApproval", "PlanApproval",
            "SupportRequest", "Message", "PartnershipLedger", "Partnership",
            "Transaction", "Account", "BudgetContributor", "Budget",
            "ProjectUpdate", "Project", "Event", "Meeting", "Plan", "Announcement",
            "DevotionInteraction", "Devotion", "Affirmation",
            "Child", "Baptism", "Appointment", "Volunteer",
            "RolePermission", "Permission", "Role",
            "MinistrySettings", "FeatureFlag", "_DeptManagers", "User", "Department"
        CASCADE
    `);

    // 1. Core Configuration
    console.log('⚙️ Configuring Global Ministry Environment...');
    await prisma.ministrySettings.create({
        data: { id: 'GLOBAL', themeOfYear: 'YEAR OF DIVINE ESTABLISHMENT', themeOfMonth: 'SEASON OF COVENANT RENEWAL', churchBudget: 25000000 }
    });

    // 2. Hubs & Departments (6 Core Departments)
    const DEPT_NAMES = ['Men of Valor', 'Women of Grace', 'NextGen Youth', 'Kingdom Kids', 'Worship Arts', 'Media & Tech'];
    const depts = await Promise.all(DEPT_NAMES.map(name => 
        (prisma.department as any).create({ data: { name, description: `Strategic hub for ${name} operations.` } })
    ));

    for (const d of depts) {
        await (prisma as any).account.create({ data: { departmentId: d.id, balance: 1000000 } });
    }

    // 3. Leadership Core (Card Format: XXX/YYY/2026)
    console.log('👑 Ordaining Leadership Core...');
    const bishop = await prisma.user.create({
        data: { name: "Bishop Emmanuel Mworia", idNumber: "BISHOP-01", membershipNumber: "001/001/2026", role: "SUPER_ADMIN", status: "ACTIVE", isCardPaid: true, dob: new Date("1965-05-15"), gender: "MALE" }
    });
    const watua = await prisma.user.create({
        data: { name: "Eng. Samuel (WATUA)", idNumber: "WATUA-01", membershipNumber: "999/001/2026", role: "WATUA", status: "ACTIVE", isCardPaid: true, dob: new Date("1990-01-01"), gender: "MALE" }
    });
    const pastor = await prisma.user.create({
        data: { name: "Pastor Joshua Kariuki", idNumber: "PAST-01", membershipNumber: "002/001/2026", role: "PASTOR", status: "ACTIVE", isCardPaid: true, dob: new Date("1978-08-20"), gender: "MALE" }
    });
    const secretary = await prisma.user.create({
        data: { name: "Jane Wanjiku", idNumber: "SEC-01", membershipNumber: "003/001/2026", role: "SECRETARY", status: "ACTIVE", isCardPaid: true, dob: new Date("1985-11-05"), gender: "FEMALE" }
    });

    const deptLeaders = await Promise.all(depts.map((d, i) => 
        prisma.user.create({
            data: {
                name: `Leader ${DEPT_NAMES[i]}`,
                idNumber: `LDR-${(i+1).toString().padStart(2, '0')}`,
                membershipNumber: `${(10 + i).toString().padStart(3, '0')}/001/2026`,
                role: "DEPARTMENT_LEADER",
                status: "ACTIVE",
                departmentId: d.id,
                isCardPaid: true,
                dob: new Date("1980-01-01"),
                gender: i % 2 === 0 ? "MALE" : "FEMALE"
            }
        })
    ));

    for (const [i, d] of depts.entries()) {
        await (prisma.department as any).update({ where: { id: d.id }, data: { leaderId: deptLeaders[i].id } });
    }

    // 4. Congregation Expansion (80+ Members = Total 100+)
    console.log('👥 Registering 80+ Covenant Members...');
    const members = [];
    for (let i = 1; i <= 85; i++) {
        const memIdx = (100 + i).toString().padStart(3, '0');
        const member = await prisma.user.create({
            data: {
                name: `Covenant Member ${i}`,
                idNumber: `ID-MEM-${memIdx}`,
                membershipNumber: `${memIdx}/001/2026`,
                role: "MEMBER",
                status: i > 80 ? "PENDING" : "ACTIVE",
                departmentId: depts[i % depts.length].id,
                isCardPaid: i % 10 !== 0,
                isPartner: i <= 30,
                membershipExpiry: i === 1 ? new Date("2025-12-31") : (i === 2 ? new Date(Date.now() + 2 * 86400000) : new Date("2026-12-31")),
                cardStatus: i === 1 ? "EXPIRED" : "ACTIVE",
                isCardReplacementRequested: i === 3,
                dob: new Date("1995-01-01"),
                gender: i % 2 === 0 ? "FEMALE" : "MALE"
            }
        });
        members.push(member);
    }

    // 5. Departmental Operations (Events, Plans, Projects & Announcements)
    console.log('🏗️ Seeding Granular Departmental Operations...');
    for (const d of depts) {
        const leader = deptLeaders.find(l => l.departmentId === d.id);
        if (!leader) continue;

        // Departmental Announcements
        await prisma.announcement.create({
            data: { title: `${d.name} Weekly Brief`, content: `Operational updates for ${d.name} members.`, authorId: leader.id, departmentId: d.id, status: "PUBLISHED" }
        });

        // Departmental Plans
        await prisma.plan.create({
            data: { title: `${d.name} 2026 Strategy`, type: "YEARLY", description: "Expansion and discipleship roadmap.", departmentId: d.id, approvalStatus: "APPROVED" }
        });

        // Departmental Events
        await prisma.event.create({
            data: { title: `${d.name} Summit`, description: `${d.name} gathering.`, date: new Date(Date.now() + 7 * 86400000), time: "14:00", location: "Annex Hall", departmentId: d.id, status: "CONFIRMED", approvalStatus: "APPROVED" }
        });

        // Departmental Projects
        await prisma.project.create({
            data: { title: `${d.name} Facility Upgrade`, description: `Renovating ${d.name} offices.`, departmentId: d.id, budget: 200000, progress: 45, status: "ACTIVE", approvalStatus: "APPROVED" }
        });

        // Departmental Meetings
        await prisma.meeting.create({
            data: { title: `${d.name} Core Sync`, departmentId: d.id, date: new Date(), time: "19:00", venue: "Boardroom", meetingType: "STRATEGY", agenda: "Growth", organizerId: leader.id, meetingStatus: "APPROVED" }
        });
    }

    // Church-Wide Announcements
    await prisma.announcement.create({
        data: { title: "🚨 GLOBAL MISSION ALERT: THE HARVEST IS RIPENING", content: "All departments to mobilize for the upcoming expansion summit.", isGlobal: true, isMajor: true, authorId: bishop.id, status: "PUBLISHED" }
    });

    // 6. Workflow Exhaustion (Baptism & Dedication flows)
    console.log('🌊 Populating Exhaustive Sacrament Flows...');
    // Baptism states
    await Promise.all([
        prisma.baptism.create({ data: { userId: members[5].id, status: 'PENDING_PASTOR_APPROVAL', notes: 'Needs interview.' } }),
        prisma.baptism.create({ data: { userId: members[6].id, status: 'APPROVED', isPaid: false, notes: 'Awaiting payment.' } }),
        prisma.baptism.create({ data: { userId: members[7].id, status: 'APPROVED', isPaid: true, paymentReference: "REF_BAP_101", notes: 'Paid, ready for immersion.' } }),
        prisma.baptism.create({ data: { userId: members[8].id, status: 'COMPLETED', isPaid: true, paymentReference: "REF_BAP_102", baptismCardNumber: "BP-2026-08" } }),
    ]);

    // Dedication states
    await Promise.all([
        prisma.child.create({ data: { parentId: members[10].id, name: "Baby Grace", dob: new Date(), gender: "FEMALE", workflowStatus: "PENDING_DEDICATION", branch: "HQ" } }),
        prisma.child.create({ data: { parentId: members[11].id, name: "Baby Samuel", dob: new Date(), gender: "MALE", workflowStatus: "DEDICATION_APPROVED", isDedicationPaid: false, branch: "HQ" } }),
        prisma.child.create({ data: { parentId: members[12].id, name: "Baby Faith", dob: new Date(), gender: "FEMALE", workflowStatus: "PAID", isDedicationPaid: true, dedicationPaymentReference: "REF_DED_505", branch: "HQ" } }),
        prisma.child.create({ data: { parentId: members[13].id, name: "Baby David", dob: new Date(), gender: "MALE", workflowStatus: "DEDICATED", isDedicated: true, isDedicationPaid: true, dedicationPaymentReference: "REF_DED_506", dedicationCardNumber: "DED-2026-13", branch: "HQ" } }),
    ]);

    // 7. Ledgers & Communications
    console.log('💬 Finalizing Financials & Communications...');
    for (const m of members.filter(x => x.isPartner)) {
        const p = await prisma.partnership.create({
            data: { userId: m.id, amount: 20000, paidAmount: 5000, balance: 15000, status: "ACTIVE" }
        });
        await (prisma as any).partnershipLedger.create({
            data: { partnershipId: p.id, amount: 5000, referenceCode: `MP_PART_${m.id.substring(0, 4)}`, status: "VERIFIED" }
        });
    }

    // Notifications & Messages
    for (let i = 0; i < 20; i++) {
        await prisma.notification.create({
            data: { userId: members[i].id, title: "Membership Alert", message: "Your annual card renewal is coming up.", type: "SYSTEM" }
        });
    }

    console.log('🏁 EXHAUSTIVE 2.0 SEEDING COMPLETE: 100+ Personas ordinated.');
}

seedGlobalData()
    .catch(e => { console.error('FATAL SEED ERROR:', e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
