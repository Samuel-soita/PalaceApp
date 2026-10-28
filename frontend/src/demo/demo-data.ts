/** Sample church data for demo mode. Dates are relative to today so the dashboards always look current. */
export type Row = Record<string, any>;

export interface DemoStore {
    users: Row[];
    departments: Row[];
    events: Row[];
    projects: Row[];
    plans: Row[];
    meetings: Row[];
    announcements: Row[];
    devotions: Row[];
    affirmation: Row;
    settings: Row;
    baptisms: Row[];
    children: Row[];
    partnerships: Row[];
    accounts: Row[];
    transactions: Row[];
    repairs: Row[];
    reports: Row[];
    appointments: Row[];
    supportRequests: Row[];
    messages: Row[];
    notifications: Row[];
    auditLogs: Row[];
    pastorModules: Row[];
    seq: number;
}

const DAY = 24 * 60 * 60 * 1000;

function at(daysFromNow: number, hour = 10): string {
    const d = new Date();
    d.setHours(hour, 0, 0, 0);
    return new Date(d.getTime() + daysFromNow * DAY).toISOString();
}

function today(): string {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
}

const DEPARTMENTS: [string, string, string][] = [
    ['demo-dept-youth', '3 SixTeen Generation', 'Youth fellowship for ages 18 to 35.'],
    ['demo-dept-worship', 'Praise and worship', 'Choir, band and worship leaders.'],
    ['demo-dept-media', 'Media & ICT', 'Livestream, photography and the church website.'],
    ['demo-dept-tech', 'Technical, Sound & Lighting', 'Sound desk, lighting and stage equipment.'],
    ['demo-dept-mission', 'Mission & Evangelism', 'Outreach, crusades and new believers.'],
    ['demo-dept-women', 'Esther Arise', "Women's fellowship."],
    ['demo-dept-men', 'PPAM ABRAHAM GENERATION', "Men's fellowship."],
    ['demo-dept-hospitality', 'Hospitality & Welfare', 'Welcoming visitors and caring for members in need.'],
    ['demo-dept-pastoral', 'Pastoral', 'The pastoral team.'],
];

const MEMBER_NAMES = [
    'Brian Kiptoo', 'Cynthia Atieno', 'Dennis Mwangi', 'Eunice Chebet', 'Felix Omondi', 'Gladys Nyambura',
    'Hillary Wekesa', 'Irene Moraa', 'Joseph Karanja', 'Lucy Wambui', 'Moses Kibet', 'Naomi Akinyi',
    'Oscar Mutiso', 'Priscilla Jepchirchir', 'Collins Barasa', 'Rose Muthoni', 'Stephen Ochieng', 'Tabitha Nduta',
    'Victor Langat', 'Winnie Adhiambo', 'Alex Kamau', 'Beatrice Wanjiku', 'Caleb Njuguna', 'Diana Kerubo',
];

const PERMISSIONS: Record<string, string[]> = {
    SUPER_ADMIN: ['VIEW_GLOBAL_STATS', 'VIEW_FINANCIALS', 'MANAGE_DEPARTMENTS', 'VIEW_PERSONNEL', 'MANAGE_USERS', 'APPROVE_BAPTISM', 'APPROVE_DEDICATION', 'VIEW_PASTORAL_PORTAL', 'ACCESS_WATUA', 'MANAGE_PERMISSIONS', 'VIEW_SYSTEM_LOGS'],
    SECRETARY: ['VIEW_GLOBAL_STATS', 'VIEW_PERSONNEL', 'MANAGE_USERS', 'APPROVE_BAPTISM', 'APPROVE_DEDICATION', 'VIEW_PASTORAL_PORTAL'],
    PASTOR: ['VIEW_PASTORAL_PORTAL', 'APPROVE_BAPTISM', 'APPROVE_DEDICATION', 'MANAGE_APPOINTMENTS'],
    DEPARTMENT_LEADER: ['VIEW_DEPARTMENT', 'MANAGE_DEPARTMENT_PROJECTS', 'MANAGE_DEPARTMENT_EVENTS', 'MANAGE_DEPARTMENT_PLANS', 'CREATE_ANNOUNCEMENTS_LOCAL'],
    MEMBER: [],
    WATUA: [],
};

export const ALL_PASTOR_MODULES = ['EventOversight', 'PartnershipManagement', 'ChildDedication', 'DevotionPublishing', 'ProjectOversight', 'MemberRegistration'];

export function permissionsFor(role: string): string[] {
    return PERMISSIONS[role] ?? [];
}

function person(id: string, name: string, role: string, departmentId: string | null, n: number, extra: Row = {}): Row {
    const num = String(n).padStart(3, '0');
    return {
        id,
        name,
        role,
        status: 'ACTIVE',
        departmentId,
        membershipNumber: `900/${num}/2026`,
        idNumber: `DEMO${num}`,
        phoneNumber: `0712 000 ${num}`,
        gender: n % 2 ? 'MALE' : 'FEMALE',
        dob: new Date(1985 + (n % 15), n % 12, (n % 27) + 1).toISOString(),
        isCardPaid: true,
        isPartner: false,
        cardStatus: 'ACTIVE',
        isCardReplacementRequested: false,
        deletionRequested: false,
        membershipExpiry: at(300),
        wrongdoingCount: 0,
        isSuspended: false,
        avatarUrl: null,
        createdAt: at(-200 + n),
        updatedAt: at(-10),
        version: 0,
        ...extra,
    };
}

export function buildDemoStore(): DemoStore {
    const users: Row[] = [
        person('demo-bishop', 'Bishop Samuel Njoroge', 'SUPER_ADMIN', null, 1),
        person('demo-pastor', 'Pastor Ruth Kamau', 'PASTOR', 'demo-dept-pastoral', 2, { canManagePartnerships: true }),
        person('demo-pastor-2', 'Pastor James Mwangi', 'PASTOR', 'demo-dept-pastoral', 3),
        person('demo-pastor-3', 'Pastor Esther Wairimu', 'PASTOR', 'demo-dept-pastoral', 4),
        person('demo-leader', 'Daniel Otieno', 'DEPARTMENT_LEADER', 'demo-dept-youth', 5),
        person('demo-leader-2', 'Faith Njeri', 'DEPARTMENT_LEADER', 'demo-dept-worship', 6),
        person('demo-leader-3', 'George Onyango', 'DEPARTMENT_LEADER', 'demo-dept-tech', 7),
        person('demo-secretary', 'Mary Achieng', 'SECRETARY', null, 8),
        person('demo-watua', 'Kevin Mutua', 'WATUA', null, 9),
        person('demo-member', 'Grace Wanjiru', 'MEMBER', 'demo-dept-youth', 10, { isPartner: true }),
    ];
    const memberDepts = ['demo-dept-youth', 'demo-dept-worship', 'demo-dept-media', 'demo-dept-mission', 'demo-dept-women', 'demo-dept-men', 'demo-dept-hospitality', 'demo-dept-tech'];
    MEMBER_NAMES.forEach((name, i) => {
        const pending = i < 3;
        users.push(person(`demo-user-${i + 1}`, name, 'MEMBER', memberDepts[i % memberDepts.length], 11 + i, {
            status: pending ? 'PENDING' : 'ACTIVE',
            isCardPaid: !pending || i === 0,
            isPartner: i % 4 === 1,
            isCardReplacementRequested: i === 5,
            membershipExpiry: i === 5 ? at(-3) : at(200 + i),
        }));
    });
    const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? 'Member';

    const leaders: Record<string, string> = { 'demo-dept-youth': 'demo-leader', 'demo-dept-worship': 'demo-leader-2', 'demo-dept-tech': 'demo-leader-3' };
    const departments = DEPARTMENTS.map(([id, name, description]) => ({
        id, name, description,
        leaderId: leaders[id] ?? null,
        leaders: leaders[id] ? [{ id: leaders[id], name: nameOf(leaders[id]) }] : [],
        createdAt: at(-365), updatedAt: at(-30), version: 0,
    }));

    const signed = (pastorsApproved: number, bishopApproved: boolean) => [
        { userId: 'demo-pastor', role: 'PASTOR', approved: pastorsApproved > 0 },
        { userId: 'demo-pastor-2', role: 'PASTOR', approved: pastorsApproved > 1 },
        { userId: 'demo-bishop', role: 'BISHOP', approved: bishopApproved },
    ];
    const approved = () => signed(2, true);

    const base = (id: string, departmentId: string, createdById: string, daysAgo: number) => ({
        id, departmentId, createdById, createdAt: at(-daysAgo), updatedAt: at(-daysAgo), version: 0,
    });

    const events: Row[] = [
        { ...base('demo-evt-1', 'demo-dept-mission', 'demo-bishop', 20), title: 'Annual Crusade at Uhuru Park', description: 'Three nights of worship, preaching and prayer for the city. Volunteers needed for ushering and counselling.', date: at(12, 17), time: '17:00', location: 'Uhuru Park, Nairobi', budgetNeeded: 250000, budgetSource: 'CHURCH', volunteersNeeded: 120, eventType: 'CHURCH_EVENT', status: 'PLANNED', isMajor: true, approvalStatus: 'APPROVED', approvals: approved() },
        { ...base('demo-evt-2', 'demo-dept-youth', 'demo-leader', 9), title: 'Youth Worship Night', description: 'An evening of worship, testimonies and a short word for young adults.', date: at(4, 18), time: '18:00', location: 'Main Sanctuary', budgetNeeded: 15000, budgetSource: 'DEPARTMENT', volunteersNeeded: 20, eventType: 'DEPARTMENT_EVENT', status: 'PLANNED', isMajor: false, approvalStatus: 'APPROVED', approvals: approved() },
        { ...base('demo-evt-3', 'demo-dept-worship', 'demo-leader-2', 3), title: 'Choir Retreat', description: 'A weekend retreat for the choir to rehearse the Christmas cantata.', date: at(18, 9), time: '09:00', location: 'Limuru Conference Centre', budgetNeeded: 60000, budgetSource: 'DEPARTMENT', volunteersNeeded: 5, eventType: 'DEPARTMENT_EVENT', status: 'PLANNED', isMajor: false, approvalStatus: 'PENDING_APPROVAL', approvals: signed(1, false) },
        { ...base('demo-evt-4', 'demo-dept-youth', 'demo-leader', 1), title: 'Campus Outreach', description: 'Evangelism and free counselling sessions at the university.', date: at(9, 14), time: '14:00', location: 'University of Nairobi', budgetNeeded: 8000, budgetSource: 'DEPARTMENT', volunteersNeeded: 30, eventType: 'DEPARTMENT_EVENT', status: 'PLANNED', isMajor: false, approvalStatus: 'PENDING_APPROVAL', approvals: signed(0, false) },
        { ...base('demo-evt-5', 'demo-dept-women', 'demo-bishop', 40), title: "Women's Conference", description: 'Esther Arise conference with guest speakers and a prayer breakfast.', date: at(25, 8), time: '08:00', location: 'Main Sanctuary', budgetNeeded: 120000, budgetSource: 'CHURCH', volunteersNeeded: 40, eventType: 'CHURCH_EVENT', status: 'PLANNED', isMajor: true, approvalStatus: 'APPROVED', approvals: approved() },
        { ...base('demo-evt-6', 'demo-dept-hospitality', 'demo-bishop', 60), title: 'Thanksgiving Sunday', description: 'Combined service with harvest offering and fellowship lunch.', date: at(-5, 9), time: '09:00', location: 'Main Sanctuary', budgetNeeded: 50000, budgetSource: 'CHURCH', volunteersNeeded: 25, eventType: 'CHURCH_EVENT', status: 'COMPLETED', isMajor: true, approvalStatus: 'APPROVED', approvals: approved() },
    ];

    const projects: Row[] = [
        { ...base('demo-prj-1', 'demo-dept-tech', 'demo-leader-3', 50), title: 'Sanctuary Sound Upgrade', description: 'Replace the main mixing desk and add stage monitors for the band.', deadline: at(45), category: 'NEW_PROJECT', budget: 480000, budgetSource: 'CHURCH', progress: 60, status: 'ACTIVE', isMajor: true, approvalStatus: 'APPROVED', approvals: approved() },
        { ...base('demo-prj-2', 'demo-dept-media', 'demo-bishop', 35), title: 'Livestream Studio', description: 'Set up a small studio for midweek livestreams and online Bible study.', deadline: at(60), category: 'NEW_PROJECT', budget: 220000, budgetSource: 'CHURCH', progress: 25, status: 'ACTIVE', isMajor: true, approvalStatus: 'APPROVED', approvals: approved() },
        { ...base('demo-prj-3', 'demo-dept-youth', 'demo-leader', 6), title: 'Youth Library Corner', description: 'Shelves and books for a reading corner in the youth hall.', deadline: at(30), category: 'NEW_PROJECT', budget: 35000, budgetSource: 'DEPARTMENT', progress: 0, status: 'PLANNED', isMajor: false, approvalStatus: 'PENDING_APPROVAL', approvals: signed(1, false) },
        { ...base('demo-prj-4', 'demo-dept-mission', 'demo-bishop', 120), title: 'Rural Church Plant, Machakos', description: 'Building a church hall for the new Machakos branch.', deadline: at(-10), category: 'NEW_PROJECT', budget: 1500000, budgetSource: 'CHURCH', progress: 100, status: 'COMPLETED', isMajor: true, approvalStatus: 'APPROVED', approvals: approved() },
    ];

    const plans: Row[] = [
        { ...base('demo-plan-1', 'demo-dept-youth', 'demo-leader', 15), title: 'Youth Discipleship Plan', type: 'QUARTERLY', content: 'Weekly small groups, a mentorship pairing for every new believer and a monthly service night.', budgetSource: 'DEPARTMENT', status: 'PLANNED', isMajor: false, approvalStatus: 'APPROVED', approvals: approved() },
        { ...base('demo-plan-2', 'demo-dept-worship', 'demo-leader-2', 4), title: 'Worship Team Training', type: 'MONTHLY', content: 'Vocal coaching on Saturdays and a new rota so every singer serves twice a month.', budgetSource: 'DEPARTMENT', status: 'PLANNED', isMajor: false, approvalStatus: 'PENDING_APPROVAL', approvals: signed(0, false) },
        { ...base('demo-plan-3', 'demo-dept-mission', 'demo-bishop', 30), title: '2027 Outreach Strategy', type: 'ANNUAL', content: 'Quarterly crusades, two new church plants and a hospital visitation programme.', budgetSource: 'CHURCH', status: 'PLANNED', isMajor: true, approvalStatus: 'APPROVED', approvals: approved() },
    ];

    const meetings: Row[] = [
        { ...base('demo-mtg-1', 'demo-dept-pastoral', 'demo-bishop', 5), title: 'Leadership Council', date: at(2, 10), time: '10:00', venue: 'Boardroom', meetingType: 'IN_PERSON', agenda: 'Crusade logistics, budget review and pastoral assignments.', organizerId: 'demo-bishop', meetingStatus: 'SCHEDULED', followUpStatus: 'PENDING' },
        { ...base('demo-mtg-2', 'demo-dept-youth', 'demo-leader', 2), title: 'Youth Committee Planning', date: at(6, 19), time: '19:00', venue: 'Google Meet', meetingType: 'VIRTUAL', agenda: 'Worship night roles and campus outreach teams.', organizerId: 'demo-leader', meetingStatus: 'SCHEDULED', followUpStatus: 'PENDING' },
        { ...base('demo-mtg-3', 'demo-dept-tech', 'demo-leader-3', 1), title: 'Sound Team Briefing', date: at(3, 16), time: '16:00', venue: 'Sound Booth', meetingType: 'HYBRID', agenda: 'New mixing desk training schedule.', organizerId: 'demo-leader-3', meetingStatus: 'SCHEDULED', followUpStatus: 'PENDING' },
    ];

    const announcement = (id: string, title: string, content: string, extra: Row) => ({
        id, title, content, priority: 'NORMAL', isGlobal: false, isMajor: false, status: 'PUBLISHED',
        authorId: 'demo-bishop', departmentId: null, approvals: [], createdAt: at(-2), updatedAt: at(-2), version: 0, ...extra,
    });
    const announcements: Row[] = [
        announcement('demo-ann-1', 'Crusade volunteers needed', 'Register with your department leader to serve at the Annual Crusade. Training is on Saturday at 2pm.', { priority: 'HIGH', isGlobal: true, isMajor: true, createdAt: at(-1) }),
        announcement('demo-ann-2', 'New service times', 'From next month the first service starts at 7:30am and the second at 10:00am.', { isGlobal: true, isMajor: true, createdAt: at(-3) }),
        announcement('demo-ann-3', 'Youth Worship Night this Friday', 'Bring a friend. Doors open at 5:30pm.', { departmentId: 'demo-dept-youth', authorId: 'demo-leader', createdAt: at(-2) }),
        announcement('demo-ann-4', 'Choir rehearsal moved', 'Thursday rehearsal moves to Wednesday this week.', { departmentId: 'demo-dept-worship', authorId: 'demo-leader-2', createdAt: at(-1) }),
        announcement('demo-ann-5', '21 days of prayer', 'Join the morning prayer line at 5am every weekday this month.', { priority: 'URGENT', isGlobal: true, isMajor: true, authorId: 'demo-pastor', createdAt: at(-6) }),
        announcement('demo-ann-6', 'Youth camp registration', 'Camp registration opens next week. Early bird fee is KES 2,500.', { status: 'PENDING', departmentId: 'demo-dept-youth', authorId: 'demo-leader', approvals: signed(1, false), createdAt: at(0) }),
    ];

    const devotions: Row[] = [{
        id: 'demo-devotion-today', title: 'Strength for Today', date: today(), authorId: 'demo-pastor',
        content: 'Isaiah 40:31 - Those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary.\n\nWhatever you face today, wait on Him in prayer before you act. Strength comes from His presence, not from our own effort.',
        themeOfMonth: 'MONTH OF NEW BEGINNINGS', themeOfYear: 'YEAR OF DIVINE ESTABLISHMENT', interactions: [
            { userId: 'demo-user-4', type: 'EMOJI', value: 'HEART' },
            { userId: 'demo-user-7', type: 'AMEN', value: 'AMEN' },
        ], createdAt: today(), updatedAt: today(), version: 0,
    }];

    const baptisms: Row[] = [
        { id: 'demo-bap-1', userId: 'demo-user-4', status: 'PENDING_PASTOR_APPROVAL', isPaid: false, createdAt: at(-2), updatedAt: at(-2) },
        { id: 'demo-bap-2', userId: 'demo-user-9', status: 'ADMIN_PAYMENT_VERIFICATION', isPaid: false, createdAt: at(-6), updatedAt: at(-4) },
        { id: 'demo-bap-3', userId: 'demo-user-12', status: 'BISHOP_APPROVED', isPaid: true, baptismCardNumber: 'BAP-2026-014', createdAt: at(-12), updatedAt: at(-7) },
        { id: 'demo-bap-4', userId: 'demo-user-15', status: 'COMPLETED', isPaid: true, baptismCardNumber: 'BAP-2026-009', recordedAt: at(-20), createdAt: at(-40), updatedAt: at(-20) },
    ];

    const child = (id: string, name: string, parentId: string, workflowStatus: string, n: number) => ({
        id, name, parentId, workflowStatus, gender: n % 2 ? 'MALE' : 'FEMALE', dob: at(-120 * n),
        departmentId: users.find((u) => u.id === parentId)?.departmentId ?? null, branch: 'HQ', status: 'ACTIVE',
        isDedicated: workflowStatus === 'DEDICATED', dedicationNumber: `DED-2026-${String(100 + n)}`,
        isDedicationPaid: ['BISHOP_RITE_PENDING', 'DEDICATED'].includes(workflowStatus),
        createdAt: at(-10 * n), updatedAt: at(-n), version: 0,
    });
    const children: Row[] = [
        child('demo-child-1', 'Baby Amani Wanjiru', 'demo-member', 'PENDING_DEDICATION', 1),
        child('demo-child-2', 'Baby Neema Atieno', 'demo-user-2', 'ADMIN_PAYMENT_VERIFICATION', 2),
        child('demo-child-3', 'Baby Baraka Kibet', 'demo-user-11', 'BISHOP_RITE_PENDING', 3),
        child('demo-child-4', 'Baby Imani Moraa', 'demo-user-8', 'DEDICATED', 4),
    ];

    const partnerships: Row[] = users.filter((u) => u.isPartner).map((u, i) => ({
        id: `demo-part-${i + 1}`, userId: u.id, amount: [5000, 2000, 10000, 3000][i % 4], frequency: 'MONTHLY', status: 'ACTIVE',
        balance: i % 2 ? 1000 : 0, paidAmount: [15000, 6000, 30000, 9000][i % 4], lastPaymentDate: at(-(i + 3)),
        ledgers: [{ id: `demo-ledger-${i + 1}`, amount: [5000, 2000, 10000, 3000][i % 4], transactionType: 'CREDIT', paymentMethod: 'MPESA', referenceCode: `QK${7310 + i}DEMO`, status: 'VERIFIED', date: at(-(i + 3)) }],
        createdAt: at(-90), updatedAt: at(-(i + 3)), version: 0,
    }));

    const accounts: Row[] = departments.filter((d) => d.id !== 'demo-dept-pastoral').map((d, i) => {
        const totalIncome = 80000 + i * 23000;
        const totalExpenditure = 30000 + i * 9000;
        return { id: `demo-acct-${d.id}`, departmentId: d.id, balance: totalIncome - totalExpenditure, totalIncome, totalExpenditure, updatedAt: at(-1), version: 0 };
    });
    const tx = (id: string, departmentId: string, type: string, amount: number, description: string, status: string, requestedById: string, daysAgo: number, approvals: Row[] = []) => ({
        id, accountId: `demo-acct-${departmentId}`, departmentId, type, amount, description, status, requestedById,
        requester: { name: nameOf(requestedById) }, approvals, date: at(-daysAgo), createdAt: at(-daysAgo), updatedAt: at(-daysAgo), version: 0,
    });
    const transactions: Row[] = [
        tx('demo-tx-1', 'demo-dept-youth', 'INCOME', 25000, 'Youth fundraiser dinner', 'APPROVED', 'demo-leader', 14),
        tx('demo-tx-2', 'demo-dept-youth', 'WITHDRAWAL', 12000, 'Sound hire for worship night', 'APPROVED', 'demo-leader', 8, [{ userId: 'demo-leader', role: 'DEPARTMENT_LEADER', approved: true }, { userId: 'demo-bishop', role: 'BISHOP', approved: true }]),
        tx('demo-tx-3', 'demo-dept-youth', 'WITHDRAWAL', 6500, 'Campus outreach transport', 'PENDING_LEADER_APPROVAL', 'demo-leader', 1),
        tx('demo-tx-4', 'demo-dept-worship', 'INCOME', 18000, 'Choir CD sales', 'APPROVED', 'demo-leader-2', 10),
        tx('demo-tx-5', 'demo-dept-tech', 'WITHDRAWAL', 45000, 'Wireless microphones', 'PENDING_LEADER_APPROVAL', 'demo-leader-3', 2),
    ];

    const repairs: Row[] = [
        { id: 'demo-rep-1', departmentId: 'demo-dept-tech', instrumentName: 'Yamaha keyboard', problemDescription: 'Several keys stuck and the sustain pedal input is loose.', estimatedCost: 12000, budgetSource: 'DEPARTMENT', status: 'PENDING_PASTOR_1', requesterId: 'demo-leader-3', approvals: [], createdAt: at(-1), updatedAt: at(-1), version: 0 },
        { id: 'demo-rep-2', departmentId: 'demo-dept-tech', instrumentName: 'Stage monitor speaker', problemDescription: 'Crackling sound at high volume; the driver needs replacement.', estimatedCost: 18500, budgetSource: 'CHURCH', status: 'PENDING_BISHOP', requesterId: 'demo-leader-3', approvals: [{ userId: 'demo-pastor', role: 'PASTOR', approved: true }, { userId: 'demo-pastor-2', role: 'PASTOR', approved: true }], createdAt: at(-6), updatedAt: at(-2), version: 0 },
    ];

    const reports: Row[] = [
        { id: 'demo-rpt-1', departmentId: 'demo-dept-youth', type: 'MONTHLY', content: 'Attendance grew from 85 to 112. Two new small groups started.', fileName: 'youth-september-report.pdf', submittedById: 'demo-leader', createdAt: at(-7), updatedAt: at(-7) },
        { id: 'demo-rpt-2', departmentId: 'demo-dept-worship', type: 'EVENT', content: 'Thanksgiving Sunday: choir ministered in both services.', fileName: 'worship-thanksgiving.pdf', submittedById: 'demo-leader-2', createdAt: at(-4), updatedAt: at(-4) },
    ];

    const appointments: Row[] = [
        { id: 'demo-appt-1', memberId: 'demo-member', targetRole: 'PASTOR', targetId: 'demo-pastor', type: 'COUNSELLING', reason: 'Guidance on a career decision.', status: 'PENDING', preferredDate: at(3), preferredTime: '11:00', createdAt: at(-1), updatedAt: at(-1), version: 0 },
        { id: 'demo-appt-2', memberId: 'demo-user-6', targetRole: 'SUPER_ADMIN', targetId: 'demo-bishop', type: 'MARRIAGE', reason: 'Pre-marital counselling booking.', status: 'PENDING', preferredDate: at(5), preferredTime: '14:00', createdAt: at(-2), updatedAt: at(-2), version: 0 },
        { id: 'demo-appt-3', memberId: 'demo-user-10', targetRole: 'PASTOR', targetId: 'demo-pastor-2', type: 'PRAYER', reason: 'Prayer for a family member in hospital.', status: 'APPROVED', approvedDate: at(1), approvedTime: '09:30', preferredDate: at(1), preferredTime: '09:30', createdAt: at(-3), updatedAt: at(-1), version: 0 },
    ];

    const supportRequests: Row[] = [
        { id: 'demo-sup-1', requesterId: 'demo-leader', eventId: 'demo-evt-4', title: 'Transport for campus outreach', description: 'Hire of a 33-seater bus for the outreach team.', amountRequired: 9000, status: 'OPEN', category: 'EVENT_FUNDING', createdAt: at(-1), updatedAt: at(-1) },
        { id: 'demo-sup-2', requesterId: 'demo-leader-2', eventId: 'demo-evt-3', title: 'Retreat accommodation', description: 'Partial support for choir accommodation.', amountRequired: 20000, status: 'FUNDED', category: 'EVENT_FUNDING', createdAt: at(-8), updatedAt: at(-3) },
    ];

    const message = (id: string, senderId: string, content: string, minutesAgo: number, extra: Row = {}) => ({
        id, senderId, content, chatType: 'GLOBAL', departmentId: null, receiverId: null, isEdited: false, isDeleted: false,
        createdAt: new Date(Date.now() - minutesAgo * 60000).toISOString(), updatedAt: new Date(Date.now() - minutesAgo * 60000).toISOString(), version: 0, ...extra,
    });
    const messages: Row[] = [
        message('demo-msg-1', 'demo-bishop', 'Blessings, leaders. Please confirm your crusade volunteer numbers by Friday.', 300),
        message('demo-msg-2', 'demo-leader', 'Youth will bring 35 volunteers, Bishop.', 280),
        message('demo-msg-3', 'demo-leader-2', 'Choir is ready for all three nights.', 240),
        message('demo-msg-4', 'demo-pastor', 'Counselling team training is on Saturday at 2pm in the boardroom.', 120),
        message('demo-msg-5', 'demo-leader', 'Thanks Pastor, we will be there.', 60, { chatType: 'DEPARTMENT', departmentId: 'demo-dept-youth' }),
    ];

    const notifications: Row[] = [
        { id: 'demo-not-1', userId: '*', title: 'Approval requested', message: 'Campus Outreach is waiting for your signature.', read: false, type: 'APPROVAL', createdAt: at(-1) },
        { id: 'demo-not-2', userId: '*', title: 'New announcement', message: 'Crusade volunteers needed.', read: false, type: 'ANNOUNCEMENT', createdAt: at(-1) },
    ];

    const auditLogs: Row[] = [
        ['USER_ACTIVATED', 'USER', 'demo-secretary'], ['EVENT_APPROVED', 'EVENT', 'demo-bishop'], ['TRANSACTION_APPROVED', 'TRANSACTION', 'demo-bishop'],
        ['DEVOTION_PUBLISHED', 'DEVOTION', 'demo-pastor'], ['PROJECT_CREATED', 'PROJECT', 'demo-leader'], ['CARD_PAYMENT_VERIFIED', 'USER', 'demo-secretary'],
    ].map(([actionType, entityType, actorId], i) => ({
        id: `demo-audit-${i + 1}`, actionType, entityType, actorId, actorRole: users.find((u) => u.id === actorId)?.role, entityId: null,
        metadata: { details: `${actionType.replace(/_/g, ' ').toLowerCase()} (sample)` }, createdAt: at(-i, 9 + i),
    }));

    const pastorModules: Row[] = ALL_PASTOR_MODULES.map((moduleKey, i) => ({
        id: `demo-pm-${i + 1}`, pastorId: 'demo-pastor', moduleKey, permissions: ['READ', 'WRITE', 'EXECUTE'], createdAt: at(-30), updatedAt: at(-30),
    }));

    return {
        users, departments, events, projects, plans, meetings, announcements, devotions,
        affirmation: { id: 'demo-affirmation', content: 'I am strengthened, guided and kept by the Lord today.', date: today() },
        settings: { id: 'GLOBAL', themeOfYear: 'YEAR OF DIVINE ESTABLISHMENT', themeOfMonth: 'MONTH OF NEW BEGINNINGS', updatedAt: at(-10), version: 0 },
        baptisms, children, partnerships, accounts, transactions, repairs, reports, appointments, supportRequests,
        messages, notifications, auditLogs, pastorModules, seq: 1,
    };
}
