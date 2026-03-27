import { PrismaClient } from '@prisma/client';
import process from 'node:process';

const prisma = new PrismaClient();

// --- Configuration & Helpers ---
const DEPARTMENTS = [
    'PPAM ABRAHAM GENERATION', 
    'Esther Arise', 
    '3 SixTeen Generation', 
    'Royal Tribe of Light', 
    'Rising star generation',
    'Pastoral & Secretariat',
    'Ushering & Protocol',
    'Media & ICT',
    'Praise and worship',
    'Hospitality & Welfare',
    'Mission & Evangelism',
    'Technical, Sound & Lighting',
    'Treasury & Finance',
    'Deacons Board',
    'Intercessory & Prayer'
];

const ROLES = {
    BISHOP: 'SUPER_ADMIN',
    SECRETARY: 'SECRETARY',
    ADMIN: 'SYSTEM_ADMIN',
    PASTOR: 'PASTOR',
    LEADER: 'DEPARTMENT_LEADER',
    MEMBER: 'MEMBER',
    WATUA: 'WATUA'
};

const firstNames = ['David', 'Sarah', 'Isaac', 'Faith', 'Samuel', 'Rebecca', 'Grace', 'Robert', 'Emmanuel', 'John', 'Jane', 'Peter', 'Luke', 'Martha', 'Joshua', 'Michael', 'Ruth', 'Esther', 'Paul', 'Mary', 'Daniel', 'Lydia', 'Joseph', 'Noami', 'Caleb', 'Chloe', 'Silas', 'Phoebe', 'Titus', 'Eunice'];
const lastNames = ['Olatunji', 'Jenkins', 'Newton', 'Okoro', 'Adebayo', 'Wilson', 'Peters', 'Harmon', 'Kareem', 'Vance', 'Light', 'Doe', 'Smith', 'Mark', 'Musisi', 'Kojo', 'Musa', 'Wanjiku', 'Ochieng', 'Mutua', 'Karanja', 'Mwau', 'Simiyu', 'Naliaka', 'Kibet', 'Chepngetich', 'Omoni', 'Zablon', 'Njoroge', 'Kamau'];

const getRandom = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
const getRandomDate = (start: Date, end: Date) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

/**
 * Logic to map users to departments based on age and gender. (Aligned with department-mapper.ts)
 */
function getDepartmentNameByDob(dob: Date, gender: string): string {
    const ageMs = Date.now() - new Date(dob).getTime();
    const age = Math.floor(ageMs / (1000 * 60 * 60 * 24 * 365.25));

    if (age < 13) return 'Rising star generation';
    if (age < 20) return '3 SixTeen Generation';
    if (age <= 32) return 'Royal Tribe of Light';
    return gender?.toUpperCase() === 'FEMALE' ? 'Esther Arise' : 'PPAM ABRAHAM GENERATION';
}

async function main() {
    console.log('🚀 INITIALIZING GLOBAL MISSION INFRASTRUCTURE SEED...');

    // 1. CLEAR DATA (REVERSED FK ORDER)
    console.log('🧹 Purging legacy records...');
    const tables = [
        'notification', 'transaction', 'message', 'supportRequest', 
        'announcementApproval', 'eventApproval', 'projectApproval', 
        'planApproval', 'meetingApproval', 'devotionInteraction', 
        'auditLog', 'baptism', 'appointment', 'partnershipLedger', 'partnership', 
        'account', 'projectUpdate', 'volunteer', 'child', 
        'announcement', 'event', 'project', 'plan', 'meeting', 
        'user', 'department', 'devotion', 'affirmation', 'ministrySettings',
        'featureFlag', 'budgetContributor', 'budget'
    ];
    for (const table of tables) {
        await (prisma as any)[table].deleteMany();
    }

    // 2. MINISTRY SETTINGS
    console.log('⚙️ Setting Global Church Vision...');
    await prisma.ministrySettings.create({
        data: {
            id: 'GLOBAL',
            themeOfYear: 'YEAR OF DIVINE ESTABLISHMENT',
            themeOfMonth: 'MONTH OF NEW BEGINNINGS',
            churchBudget: 1500000
        }
    });

    // 3. DEPARTMENTS
    console.log('🏢 Establishing 15 Operational Sectors...');
    const depts = [];
    for (const name of DEPARTMENTS) {
        const d = await prisma.department.create({
            data: {
                name,
                description: `Prayer Palace Apostolic Ministry — Strategic Hub for ${name} operations.`,
            }
        });
        // Create Account for each Dept
        await prisma.account.create({
            data: {
                departmentId: d.id,
                balance: 50000 + (Math.random() * 200000),
                totalIncome: 75000 + (Math.random() * 100000),
                totalExpenditure: 15000 + (Math.random() * 50000)
            }
        });
        depts.push(d);
    }

    // 4. CORE USERS (Roles)
    console.log('👑 Seeding Core Leadership roles...');
    
    // WATUA (The Ghost)
    const watua = await prisma.user.create({
        data: {
            name: 'Eng. Samuel Soita',
            idNumber: 'WATUA-ENG-001',
            membershipNumber: 'WATUA-001',
            dob: new Date('1990-01-01'),
            role: ROLES.WATUA,
            status: 'ACTIVE',
            isCardPaid: true
        } as any
    });

    // ADMINS
    const bishop = await prisma.user.create({
        data: {
            name: 'Bishop David Olatunji',
            idNumber: 'PPAM-BISHOP-001',
            membershipNumber: '001/001/2026',
            dob: new Date('1965-05-12'),
            role: ROLES.BISHOP,
            status: 'ACTIVE',
            isCardPaid: true,
            gender: 'MALE'
        } as any
    });

    const secretary = await prisma.user.create({
        data: {
            name: 'Pst. Joshua Musisi',
            idNumber: 'PPAM-SEC-001',
            membershipNumber: '003/001/2026',
            dob: new Date('1975-11-20'),
            role: ROLES.SECRETARY,
            status: 'ACTIVE',
            isCardPaid: true,
            gender: 'MALE'
        } as any
    });

    const systemAdmin = await prisma.user.create({
        data: {
            name: 'Bro. Barnabas Kintu',
            idNumber: 'PPAM-SYS-001',
            membershipNumber: '005/001/2026',
            dob: new Date('1985-04-15'),
            role: ROLES.ADMIN,
            status: 'ACTIVE',
            isCardPaid: true,
            gender: 'MALE'
        } as any
    });

    // PASTORS
    const residentPastor = await prisma.user.create({
        data: {
            name: 'Res. Pst. Emmanuel Light',
            idNumber: 'PPAM-RPAST-001',
            membershipNumber: '101/001/2026',
            dob: new Date('1972-03-10'),
            role: ROLES.PASTOR,
            status: 'ACTIVE',
            isCardPaid: true,
            gender: 'MALE'
        } as any
    });

    const assocPastors = [];
    for (let i = 1; i <= 3; i++) {
        const ap = await prisma.user.create({
            data: {
                name: `Assoc. Pst. ${getRandom(firstNames)} ${getRandom(lastNames)}`,
                idNumber: `PPAM-APAST-00${i}`,
                membershipNumber: `${(101 + i).toString().padStart(3, '0')}/001/2026`,
                dob: new Date('1980-01-01'),
                role: ROLES.PASTOR,
                status: 'ACTIVE',
                isCardPaid: true,
                gender: 'MALE'
            } as any
        });
        assocPastors.push(ap);
    }

    // LEADERS (All 15 Departments)
    console.log('🛡️ Appointing 15 Departmental Leaders...');
    const leaders = [];
    for (let i = 0; i < depts.length; i++) {
        const d = depts[i];
        const leader = await prisma.user.create({
            data: {
                name: `Dn. ${getRandom(firstNames)} ${getRandom(lastNames)}`,
                idNumber: `PPAM-LEAD-${i.toString().padStart(3, '0')}`,
                membershipNumber: `${(201 + i).toString().padStart(3, '0')}/001/2026`,
                dob: new Date('1982-01-01'),
                role: ROLES.LEADER,
                status: 'ACTIVE',
                departmentId: d.id,
                isCardPaid: true,
                gender: Math.random() > 0.5 ? 'MALE' : 'FEMALE'
            } as any
        });
        leaders.push(leader);
        await prisma.department.update({ where: { id: d.id }, data: { leaderId: leader.id } });
    }

    // MEMBERS (100 Total Covenant Members)
    console.log('👥 Registering 85 additional Covenant Members (Total 100+ personas)...');
    const members = [];
    for (let i = 1; i <= 85; i++) {
        const gender = Math.random() > 0.5 ? 'MALE' : 'FEMALE';
        const dob = getRandomDate(new Date('1956-01-01'), new Date('2025-01-01'));
        
        // 50% chance of random department, 50% chance of age/gender based
        let d;
        if (Math.random() > 0.5) {
            d = getRandom(depts);
        } else {
            const deptName = getDepartmentNameByDob(dob, gender);
            d = depts.find(dept => dept.name === deptName) || depts[0];
        }

        const member = await prisma.user.create({
            data: {
                name: `${getRandom(firstNames)} ${getRandom(lastNames)}`,
                idNumber: `PPAM-MEM-ID-${(i + 100).toString().padStart(4, '0')}`,
                membershipNumber: `${(301 + i).toString().padStart(3, '0')}/001/2026`,
                dob,
                role: ROLES.MEMBER,
                status: 'ACTIVE',
                departmentId: d.id,
                isCardPaid: i % 10 !== 0,
                gender: gender,
                phoneNumber: `+254700${i.toString().padStart(3, '0')}123`,
                isPartner: Math.random() < 0.3
            } as any
        });
        members.push(member);
    }
    // Total Users: 1 + 1 + 1 + 1 + 1 + 3 + 15 + 77 = 100 exactly.

    // 5. SPIRITUAL CONTENT
    console.log('📖 Seeding 30 days of Devotions & Affirmations...');
    for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        await prisma.devotion.create({
            data: {
                title: `Prophetic Insight: Day ${30 - i}`,
                content: `Heavenly alignment manifests in your life today. Walking in the light of the Word...`,
                themeOfMonth: 'DIVINE ESTABLISHMENT',
                themeOfYear: 'YEAR OF DIVINE ESTABLISHMENT',
                date: date
            }
        });
        await prisma.affirmation.create({
            data: {
                content: `I am established in the kingdom. No weapon formed against me shall prosper.`,
                date: date
            }
        });
    }

    // 6. WORKFLOWS: CHILDREN & BAPTISM
    console.log('👶 Seeding Child Dedications & Lineage...');
    const sundaySchool = depts.find(d => d.name === 'Rising star generation');
    for (const member of members.slice(0, 85)) { // Link more children for testing
        const childCount = Math.floor(Math.random() * 3); // 0-2 children
        for (let c = 1; c <= childCount; c++) {
            await prisma.child.create({
                data: {
                    name: `${member.name} Junior ${c}`,
                    dob: getRandomDate(new Date('2015-01-01'), new Date('2023-01-01')),
                    gender: Math.random() > 0.5 ? 'MALE' : 'FEMALE',
                    parentId: member.id,
                    departmentId: sundaySchool?.id,
                    branch: 'HQ',
                    status: 'ACTIVE',
                    workflowStatus: 'DEDICATED',
                    isDedicated: true,
                    dedicationNumber: `DED/${member.membershipNumber.split('/')[0]}/${c}/2026`
                }
            });
        }
    }

    console.log('💧 Seeding Baptism Requests...');
    for (const member of members.slice(31, 46)) {
        await prisma.baptism.create({
            data: {
                userId: member.id,
                status: getRandom(['PENDING_PASTOR_APPROVAL', 'APPROVED', 'COMPLETED', 'ADMIN_PAYMENT_VERIFICATION']),
                notes: 'Awaiting immersion service in the next quarter.',
                plannedDate: new Date('2026-06-15')
            }
        });
    }

    // 7. BUDGETS & PARTNERSHIPS
    console.log('💰 Seeding Partnership Enrollments...');
    for (const partner of members.filter(m => m.isPartner)) {
        await prisma.partnership.create({
            data: {
                userId: partner.id,
                amount: 5000 + (Math.random() * 20000),
                paidAmount: 2000,
                balance: 3000,
                frequency: 'MONTHLY',
                status: 'ACTIVE'
            }
        });
    }

    // 8. OPERATIONS: PROJECTS, EVENTS, PLANS, ANNOUNCEMENTS
    console.log('🏗️ Seeding Departmental Operations (Projects, Events, Plans)...');
    for (const d of depts) {
        const leader = leaders.find(l => l.departmentId === d.id);
        if (!leader) continue;

        // Plan
        const plan = await prisma.plan.create({
            data: {
                departmentId: d.id,
                title: `2026 ${d.name} Tactical Roadmap`,
                type: 'YEARLY',
                description: `Strategic planning for the ${d.name} sector.`,
                approvalStatus: 'APPROVED'
            }
        });
        await prisma.planApproval.create({ data: { planId: plan.id, userId: bishop.id, role: 'SUPER_ADMIN' } });

        // Project
        const project = await prisma.project.create({
            data: {
                title: `${d.name} Digital Integration`,
                description: `Modernizing local tools for the ${d.name} department.`,
                departmentId: d.id,
                budget: 15000,
                status: 'IN_PROGRESS',
                approvalStatus: 'APPROVED',
                progress: 25
            }
        });
        await prisma.projectUpdate.create({ data: { projectId: project.id, message: 'Initial infrastructure setup complete.' } });

        // Event
        const event = await prisma.event.create({
            data: {
                title: `${d.name} Quarterly Summit`,
                description: `Reviewing technical and spiritual progress.`,
                date: new Date('2026-05-10'),
                time: '10:00 AM',
                location: 'Main Sanctuary',
                departmentId: d.id,
                status: 'PLANNED',
                approvalStatus: 'APPROVED'
            }
        });
        await prisma.supportRequest.create({
            data: {
                eventId: event.id,
                requesterId: leader.id,
                title: 'Logistics Support',
                description: 'Funds for refreshments and media branding.',
                amountRequired: 2500,
                status: 'OPEN'
            }
        });

        // Announcement
        await prisma.announcement.create({
            data: {
                title: `${d.name} Operational Update`,
                content: `All members are required to attend the briefings next Sunday.`,
                priority: 'NORMAL',
                authorId: leader.id,
                departmentId: d.id,
                status: 'PUBLISHED'
            }
        });
    }

    // Global Announcement
    await prisma.announcement.create({
        data: {
            title: '🚨 CHURCH-WIDE UPDATE: VISION 2026',
            content: 'Prayer Palace is moving into a new dimension of impact. All sectors report to HQ.',
            priority: 'URGENT',
            isGlobal: true,
            isMajor: true,
            authorId: bishop.id,
            status: 'PUBLISHED'
        }
    });

    // 9. MEETINGS & APPOINTMENTS
    console.log('🗓️ Seeding Meetings & Spiritual Appointments...');
    for (const d of depts) {
        const leader = leaders.find(l => l.departmentId === d.id);
        if (!leader) continue;
        await prisma.meeting.create({
            data: {
                title: `${d.name} Weekly Briefing`,
                departmentId: d.id,
                date: new Date('2026-03-24'),
                time: '06:00 PM',
                venue: 'Virtual Hub A',
                meetingType: 'STRATEGY',
                agenda: 'Tactical alignment for the upcoming quarter.',
                organizerId: leader.id,
                meetingStatus: 'APPROVED'
            }
        });
    }

    for (let i = 0; i < 10; i++) {
        await prisma.appointment.create({
            data: {
                memberId: members[i].id,
                targetRole: i % 2 === 0 ? 'BISHOP' : 'PASTOR',
                targetId: i % 2 === 0 ? bishop.id : residentPastor.id,
                type: 'COUNSELING',
                reason: 'Spiritual guidance and family blessing.',
                status: 'PENDING',
                preferredDate: new Date('2026-03-30'),
                preferredTime: '11:00 AM'
            }
        });
    }

    // 10. COMMUNICATIONS: MESSAGES & NOTIFICATIONS
    console.log('💬 Seeding Inter-Departmental Communications...');
    for (let i = 0; i < 15; i++) {
        const d = depts[i % depts.length];
        const leader = leaders.find(l => l.departmentId === d.id);
        if (!leader) continue;
        
        await prisma.message.create({
            data: {
                content: `Strategic update for ${d.name} is now available in the plans tab.`,
                senderId: leader.id,
                receiverId: systemAdmin.id,
                departmentId: d.id,
                chatType: 'DEPARTMENT'
            }
        });

        await prisma.notification.create({
            data: {
                userId: leader.id,
                title: 'Plan Approved',
                message: 'Your tactical roadmap has been vetted and approved by the Bishop.',
                read: false
            }
        });
    }

    // 11. FINANCE: TRANSACTION SAMPLES
    console.log('📊 Seeding Financial Transactions...');
    for (const d of depts) {
        const acc = await prisma.account.findUnique({ where: { departmentId: d.id } });
        if (!acc) continue;
        const leader = leaders.find(l => l.departmentId === d.id);
        if (!leader) continue;

        const t1 = await prisma.transaction.create({
            data: {
                accountId: acc.id,
                type: 'INCOME',
                amount: 5000,
                description: 'Sunday Tithes Allocation',
                status: 'APPROVED',
                requestedById: leader.id,
            }
        });
        await prisma.transactionApproval.create({ data: { transactionId: t1.id, userId: systemAdmin.id, role: 'SYSTEM_ADMIN' } });

        const t2 = await prisma.transaction.create({
            data: {
                accountId: acc.id,
                type: 'EXPENSE',
                amount: 1200,
                description: 'Media Equipment Repairs',
                status: 'APPROVED',
                requestedById: leader.id,
            }
        });
        await prisma.transactionApproval.create({ data: { transactionId: t2.id, userId: systemAdmin.id, role: 'SYSTEM_ADMIN' } });
    }

    // 12. SYSTEM INFRASTRUCTURE: FEATURE FLAGS & METRICS
    console.log('📊 Seeding System Infrastructure & Metrics...');
    await prisma.featureFlag.createMany({
        data: [
            { name: 'REGISTRATION_OPEN', enabled: true, scope: 'GLOBAL' },
            { name: 'PARTNERSHIP_MODULE', enabled: true, scope: 'GLOBAL' },
            { name: 'BAPTISM_PORTAL', enabled: true, scope: 'GLOBAL' }
        ]
    });

    await prisma.systemMetric.create({
        data: {
            latency: 45.5,
            activeUsers: 102,
            errorCount: 0,
            failedJobs: 0,
            wsConnections: 8,
            pendingApproval: 4
        }
    });

    await prisma.auditLog.create({
        data: {
            actorId: systemAdmin.id,
            actorRole: 'SYSTEM_ADMIN',
            actionType: 'SYSTEM_BOOT',
            entityType: 'SYSTEM',
            metadata: { version: '2.0.0-PROD' }
        }
    });

    console.log('🏁 GLOBAL MISSION INFRASTRUCTURE SEED COMPLETE.');
    console.log(`- Users: ${await prisma.user.count()}`);
    console.log(`- Departments: ${await prisma.department.count()}`);
    console.log(`- Accounts: ${await prisma.account.count()}`);
    console.log(`- Projects: ${await prisma.project.count()}`);
    console.log(`- Events: ${await prisma.event.count()}`);
    console.log(`- Children: ${await prisma.child.count()}`);
    console.log(`- Baptisms: ${await prisma.baptism.count()}`);
    console.log(`- Partnerships: ${await prisma.partnership.count()}`);
    console.log(`- Meetings: ${await prisma.meeting.count()}`);
    console.log(`- Devotions/Affirmations: 60`);
    console.log('⚡ Environment ready for production-level verification.');
}

main()
    .catch((e) => {
        console.error('❌ SEED FAILED:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
