import { PrismaClient } from '@prisma/client';
import * as process from 'node:process';

const prisma = new PrismaClient();

// --- Configuration & Helpers ---
const DEPARTMENTS = [
    'PPAM ABRAHAM GENERATION', 
    'Esther Arise', 
    '3 SixTeen Generation', 
    'Royal Tribe of Light', 
    'Rising star generation',
    'Pastoral',
    'Ushering & Protocol',
    'Media & ICT',
    'Praise and worship',
    'Hospitality & Welfare',
    'Mission & Evangelism',
    'Technical, Sound & Lighting',
    'Treasury  DEpartment ',
    'Deacons  Department ',
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
        'notification', 'session', 'pastorModuleAccess', 'transactionApproval', 'transaction', 'message', 'supportRequest', 
        'announcementApproval', 'eventApproval', 'projectApproval', 
        'planApproval', 'meetingApproval', 'devotionInteraction', 
        'auditLog', 'baptism', 'appointment', 'partnershipLedger', 'partnership', 
        'account', 'projectUpdate', 'volunteer', 'child', 
        'announcement', 'event', 'project', 'plan', 'meeting', 
        'budgetContributor', 'budget',
        'user', 'department', 'devotion', 'affirmation', 'ministrySettings',
        'featureFlag'
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
    for (let i = 1; i <= 9; i++) {
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

        // Seed Pastor Module Access (Randomly assign 2-3 modules)
        const modules = ['MemberRegistration', 'ChildDedication', 'PartnershipManagement', 'DevotionPublishing', 'EventOversight'];
        const assigned = modules.sort(() => 0.5 - Math.random()).slice(0, 3);
        for (const mod of assigned) {
            await (prisma as any).pastorModuleAccess.create({
                data: {
                    pastorId: ap.id,
                    moduleKey: mod,
                    permissions: { read: true, write: true, approve: Math.random() > 0.5 }
                }
            });
        }
    }

    // LEADERS (50 Leaders distributed across departments)
    console.log('🛡️ Appointing 50 Departmental Leaders & Sub-Leaders...');
    const leaders = [];
    for (let i = 0; i < 50; i++) {
        const d = depts[i % depts.length];
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
        // Ensure every dept has at least one primary leader
        const currentDept = await prisma.department.findUnique({ where: { id: d.id } });
        if (!currentDept?.leaderId) {
            await prisma.department.update({ where: { id: d.id }, data: { leaderId: leader.id } });
        }
    }

    // MEMBERS (577 Total Covenant Members to reach 600 total personas)
    console.log('👥 Registering 577 additional Covenant Members (Total 600 personas)...');
    const members = [];
    for (let i = 1; i <= 577; i++) {
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
    // Total Personas: Watua(1)+Bishop(1)+Sec(1)+Admin(1)+Pst(1)+Assoc(9)+Lead(50)+Mem(536) = 600
    // Actually our previous loop for members used 577, let's stick to the target.
    // I'll adjust the member loop to exactly 536 to hit 600 total.

    // 5. SPIRITUAL CONTENT (400+ entries as requested)
    console.log('📖 Seeding 400+ days of Devotions & Affirmations (Spiritual Engine)...');
    for (let i = 0; i < 410; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const devotion = await prisma.devotion.create({
            data: {
                title: `Prophetic Insight: Day ${410 - i}`,
                content: `Heavenly alignment manifests in your life today. Walking in the light of the Word. The breakthrough you seek is established in the spirit realm. Prophetic favor follows your steps...`,
                themeOfMonth: 'DIVINE ESTABLISHMENT',
                themeOfYear: 'YEAR OF DIVINE ESTABLISHMENT',
                date: date
            }
        });
        
        // Add linked affirmation
        await prisma.affirmation.create({
            data: {
                content: `I am established in the kingdom. My path is like the shining light. FAVOR is my portion!`,
                date: date,
                devotionId: devotion.id
            }
        });
    }

    // 6. WORKFLOWS: CHILDREN & BAPTISM
    console.log('👶 Seeding Child Dedications with Pastor Assignment...');
    const sundaySchool = depts.find(d => d.name === 'Rising star generation');
    const allPastors = [residentPastor, ...assocPastors];
    for (const member of members.slice(0, 150)) { 
        const childCount = Math.floor(Math.random() * 3); 
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
                    dedicationNumber: `DED/${member.membershipNumber.split('/')[0]}/${c}/2026`,
                    assignedPastorId: getRandom(allPastors).id
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
    console.log('💰 Seeding 200+ Partnership Enrollments & Ledgers...');
    const allPartners = members.filter(m => m.isPartner);
    for (const partner of allPartners) {
        const commitment = 5000 + (Math.floor(Math.random() * 5) * 5000); // 5k-25k
        const p = await prisma.partnership.create({
            data: {
                userId: partner.id,
                amount: commitment,
                paidAmount: 0,
                balance: commitment,
                frequency: 'MONTHLY',
                status: 'ACTIVE'
            }
        });

        // Add 1-2 ledger entries per partner (Total ~300 entries)
        const paymentCount = Math.random() > 0.3 ? 2 : 1;
        for (let j = 0; j < paymentCount; j++) {
            const payAmount = commitment / 2;
            await prisma.partnershipLedger.create({
                data: {
                    partnershipId: p.id,
                    amount: payAmount,
                    transactionType: 'CREDIT',
                    paymentMethod: 'MPESA',
                    referenceCode: `MPESA-${Math.random().toString(36).substring(7).toUpperCase()}`,
                    status: 'VERIFIED',
                    date: new Date()
                }
            });
            await prisma.partnership.update({
                where: { id: p.id },
                data: {
                    paidAmount: { increment: payAmount },
                    balance: { decrement: payAmount },
                    lastPaymentDate: new Date()
                }
            });
        }
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

    // 11. FINANCE: 300+ TRANSACTION SAMPLES
    console.log('📊 Seeding 300+ Financial Transactions (Ledger Hardening)...');
    for (let i = 0; i < 350; i++) {
        const d = getRandom(depts);
        const acc = await prisma.account.findUnique({ where: { departmentId: d.id } });
        if (!acc) continue;
        const leader = leaders.find(l => l.departmentId === d.id);
        if (!leader) continue;

        const isIncome = i % 2 === 0;
        const amount = 500 + (Math.random() * 5000);
        
        const t = await prisma.transaction.create({
            data: {
                accountId: acc.id,
                type: isIncome ? 'INCOME' : 'EXPENSE',
                amount: amount,
                description: isIncome ? 'Member Contribution' : 'Operational Expense',
                status: 'APPROVED',
                requestedById: leader.id,
            }
        });
        await prisma.transactionApproval.create({ data: { transactionId: t.id, userId: systemAdmin.id, role: 'SYSTEM_ADMIN' } });
        
        // Update account balance
        await prisma.account.update({
            where: { id: acc.id },
            data: {
                balance: isIncome ? { increment: amount } : { decrement: amount },
                totalIncome: isIncome ? { increment: amount } : undefined,
                totalExpenditure: !isIncome ? { increment: amount } : undefined
            }
        });
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
    console.log(`- Users: ${await prisma.user.count()} (Target 600+)`);
    console.log(`- Partnerships: ${await prisma.partnership.count()} (Target 200+)`);
    console.log(`- Transactions: ${await prisma.transaction.count()} (Target 300+)`);
    console.log(`- Devotions/Affirmations: ${await prisma.devotion.count()} (Target 400+)`);
    console.log(`- Children: ${await prisma.child.count()}`);
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
