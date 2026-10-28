import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { buildDemoStore, permissionsFor, type DemoStore, type Row } from './demo-data';
import { DEMO_STORE_KEY } from './demo-session';

class DemoError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

let store: DemoStore | null = null;

function db(): DemoStore {
    if (store) return store;
    try {
        const saved = sessionStorage.getItem(DEMO_STORE_KEY);
        store = saved ? JSON.parse(saved) : buildDemoStore();
    } catch {
        store = buildDemoStore();
    }
    return store as DemoStore;
}

function save() {
    try {
        sessionStorage.setItem(DEMO_STORE_KEY, JSON.stringify(db()));
    } catch {
        // Storage full: the demo keeps working in memory for this page load.
    }
}

export function resetDemoStore() {
    store = buildDemoStore();
    save();
}

const now = () => new Date().toISOString();
const nextId = (prefix: string) => `demo-${prefix}-${Date.now().toString(36)}-${db().seq++}`;

function me(): Row {
    const session = JSON.parse(localStorage.getItem('user') || 'null');
    const record = db().users.find((u) => u.id === session?.id);
    if (!record) throw new DemoError(401, 'Demo session ended. Please start the demo again.');
    return record;
}

const ADMIN_ROLES = ['SUPER_ADMIN', 'WATUA', 'SYSTEM_ADMIN', 'SECRETARY'];
const isAdmin = (u: Row) => ADMIN_ROLES.includes(u.role);
const isPastor = (u: Row) => u.role === 'PASTOR' || u.role === 'ASSOCIATE_PASTOR';

function deptName(id?: string | null) {
    return db().departments.find((d) => d.id === id)?.name;
}

function brief(id?: string | null) {
    const u = db().users.find((x) => x.id === id);
    return u ? { id: u.id, name: u.name, role: u.role, avatarUrl: u.avatarUrl, membershipNumber: u.membershipNumber, departmentId: u.departmentId } : null;
}

function withRefs(row: Row): Row {
    const out: Row = { ...row };
    if ('departmentId' in row) out.department = row.departmentId ? { id: row.departmentId, name: deptName(row.departmentId) } : null;
    if (row.authorId) out.author = brief(row.authorId);
    if (row.requesterId) out.requester = brief(row.requesterId);
    if (row.requestedById) out.requester = brief(row.requestedById);
    if (row.submittedById) out.submittedBy = brief(row.submittedById);
    if (row.memberId) out.member = brief(row.memberId);
    if (row.targetId) out.target = brief(row.targetId);
    if (row.senderId) out.sender = brief(row.senderId);
    if (row.organizerId) out.organizer = brief(row.organizerId);
    if (row.userId && !row.user) out.user = brief(row.userId);
    if (row.parentId) out.parent = brief(row.parentId);
    if (Array.isArray(row.approvals)) {
        out.approvals = row.approvals.map((a: Row) => ({ id: `${row.id}-${a.userId}`, ...a, user: a.user || brief(a.userId) }));
    }
    return out;
}

const live = (rows: Row[]) => rows.filter((r) => !r.deletedAt);

// ---------- Content (events, projects, plans, meetings, announcements) ----------

type ContentKind = 'events' | 'projects' | 'plans' | 'meetings' | 'announcements';
const CONTENT: Record<string, ContentKind> = { events: 'events', projects: 'projects', plans: 'plans', meetings: 'meetings', announcements: 'announcements' };

function approvedField(kind: ContentKind) {
    if (kind === 'announcements') return { field: 'status', approved: 'PUBLISHED', pending: 'PENDING' };
    if (kind === 'meetings') return { field: 'meetingStatus', approved: 'SCHEDULED', pending: 'PENDING_APPROVAL' };
    return { field: 'approvalStatus', approved: 'APPROVED', pending: 'PENDING_APPROVAL' };
}

function canSee(user: Row, kind: ContentKind, row: Row) {
    const { field, approved } = approvedField(kind);
    const isApproved = row[field] === approved;
    if (isAdmin(user) || isPastor(user)) return true;
    if (user.role === 'DEPARTMENT_LEADER') {
        const assigned = (row.approvals || []).some((a: Row) => a.userId === user.id);
        return row.departmentId === user.departmentId || assigned || (isApproved && (row.isMajor || row.isGlobal));
    }
    if (kind === 'meetings') return false;
    return isApproved && (row.departmentId === user.departmentId || row.isMajor || row.isGlobal);
}

function visible(kind: ContentKind, user: Row, includeDeleted = false) {
    const rows = includeDeleted ? db()[kind] : live(db()[kind]);
    return rows.filter((r) => r.deletedAt || canSee(user, kind, r)).map(withRefs);
}

function findRow(rows: Row[], id: string) {
    const row = rows.find((r) => r.id === id && !r.deletedAt);
    if (!row) throw new DemoError(404, 'Record not found.');
    return row;
}

const STRIP_ON_WRITE = ['id', 'version', 'syncStatus', 'deviceId', 'lastModifiedBy', 'department', 'author', 'approvals', 'createdAt', 'updatedAt'];

function clean(body: Row) {
    const out: Row = {};
    for (const [k, v] of Object.entries(body || {})) if (!STRIP_ON_WRITE.includes(k)) out[k] = v;
    return out;
}

function createContent(kind: ContentKind, body: Row) {
    const user = me();
    const { field, approved, pending } = approvedField(kind);
    const autoApprove = ['SUPER_ADMIN', 'WATUA', 'SYSTEM_ADMIN', 'SECRETARY'].includes(user.role);
    const { pastorIds, audience, ...rest } = clean(body);
    const pastors: string[] = Array.isArray(pastorIds) ? pastorIds.filter(Boolean) : [];
    if (!autoApprove && kind !== 'meetings' && pastors.length !== 2) {
        throw new DemoError(400, 'You must select exactly 2 Pastors to approve this item.');
    }
    const approvals = autoApprove || kind === 'meetings'
        ? []
        : [...pastors.map((id) => ({ userId: id, role: 'PASTOR', approved: false })), { userId: 'demo-bishop', role: 'BISHOP', approved: false }];
    const row: Row = {
        id: nextId(kind.slice(0, 3)),
        ...rest,
        departmentId: rest.departmentId || (rest.isGlobal || audience === 'CHURCH_WIDE' ? null : user.departmentId) || (kind === 'announcements' ? null : 'demo-dept-pastoral'),
        createdById: user.id,
        authorId: kind === 'announcements' ? user.id : undefined,
        organizerId: kind === 'meetings' ? user.id : undefined,
        [field]: autoApprove || kind === 'meetings' ? approved : pending,
        approvals,
        createdAt: now(),
        updatedAt: now(),
        version: 0,
    };
    if (kind === 'events' || kind === 'projects' || kind === 'plans') row.status = kind === 'projects' ? (rest.status || 'PLANNED') : 'PLANNED';
    if (kind === 'projects') row.progress = 0;
    db()[kind].unshift(row);
    notifyApprovers(approvals, `${row.title} is waiting for your signature.`);
    audit(`${kind.slice(0, -1).toUpperCase()}_CREATED`, kind.slice(0, -1).toUpperCase(), row.id);
    save();
    return withRefs(row);
}

function updateContent(kind: ContentKind, id: string, body: Row) {
    const row = findRow(db()[kind], id);
    const user = me();
    const { field, approved } = approvedField(kind);
    const changes = clean(body);
    delete changes.pastorIds;
    delete changes.audience;
    if (kind !== 'announcements' && kind !== 'meetings') delete changes.approvalStatus;
    if (kind === 'announcements' && changes.status === 'PUBLISHED' && !['SUPER_ADMIN', 'WATUA'].includes(user.role)) {
        throw new DemoError(403, 'Only the Bishop can publish directly. Use Approve instead.');
    }
    Object.assign(row, changes, { updatedAt: now(), version: (row.version || 0) + 1 });
    if (field in changes && changes[field] === approved) row.approvals = (row.approvals || []).map((a: Row) => ({ ...a, approved: true }));
    save();
    return withRefs(row);
}

function approveContent(kind: ContentKind, id: string) {
    const row = findRow(db()[kind], id);
    const user = me();
    const { field, approved, pending } = approvedField(kind);
    if (row[field] !== pending && row[field] !== 'PENDING') throw new DemoError(400, 'This item is no longer awaiting approval.');
    const approvals: Row[] = row.approvals || [];
    const mine = approvals.find((a) => a.userId === user.id);
    if (mine?.approved) throw new DemoError(400, 'You have already approved this item.');
    if (mine) mine.approved = true;
    else if (user.role === 'SUPER_ADMIN' && !approvals.some((a) => a.role === 'BISHOP')) approvals.push({ userId: user.id, role: 'BISHOP', approved: true });
    else throw new DemoError(403, 'Only the assigned pastors and the Bishop can approve this item.');
    const signed = approvals.filter((a) => a.approved);
    const quorum = signed.some((a) => a.role === 'BISHOP') && signed.filter((a) => a.role === 'PASTOR').length >= 2;
    if (quorum) row[field] = approved;
    row.approvals = approvals;
    row.updatedAt = now();
    audit(quorum ? 'APPROVAL_COMPLETED' : 'APPROVAL_SIGNED', kind.slice(0, -1).toUpperCase(), row.id);
    save();
    return { message: quorum ? 'Approved and published.' : 'Signature recorded.', quorumMet: quorum, [kind.slice(0, -1)]: withRefs(row) };
}

function setContentStatus(kind: ContentKind, id: string, status: string) {
    const row = findRow(db()[kind], id);
    const user = me();
    const { field } = approvedField(kind);
    const assigned = (row.approvals || []).some((a: Row) => a.userId === user.id);
    if (!['SUPER_ADMIN', 'WATUA'].includes(user.role) && !(assigned && status === 'REJECTED')) {
        throw new DemoError(403, 'Only the assigned pastors and the Bishop can reject this item.');
    }
    row[field] = status;
    row.updatedAt = now();
    save();
    return { message: `Status updated to ${status}`, [kind.slice(0, -1)]: withRefs(row) };
}

function deleteContent(kind: ContentKind, id: string) {
    const row = findRow(db()[kind], id);
    row.deletedAt = now();
    row.updatedAt = now();
    save();
    return { message: 'Deleted.' };
}

// ---------- Helpers shared by several handlers ----------

function audit(actionType: string, entityType: string, entityId?: string) {
    const user = me();
    db().auditLogs.unshift({ id: nextId('audit'), actionType, entityType, entityId, actorId: user.id, actorRole: user.role, metadata: { details: actionType.replace(/_/g, ' ').toLowerCase() }, createdAt: now() });
    db().auditLogs = db().auditLogs.slice(0, 60);
}

function notifyApprovers(approvals: Row[], message: string) {
    for (const a of approvals) {
        db().notifications.unshift({ id: nextId('not'), userId: a.userId, title: 'Approval requested', message, read: false, type: 'APPROVAL', createdAt: now() });
    }
}

function accountFor(departmentId: string) {
    let account = db().accounts.find((a) => a.departmentId === departmentId);
    if (!account) {
        account = { id: `demo-acct-${departmentId}`, departmentId, balance: 0, totalIncome: 0, totalExpenditure: 0, updatedAt: now(), version: 0 };
        db().accounts.push(account);
    }
    return account;
}

function todaysDevotion() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return live(db().devotions).find((d) => new Date(d.date).getTime() >= start.getTime());
}

function publicUser(u: Row) {
    const { idNumber: _idNumber, ...rest } = u;
    return { ...rest, department: u.departmentId ? { id: u.departmentId, name: deptName(u.departmentId) } : null };
}

function sessionUser(u: Row) {
    return {
        id: u.id, name: u.name, role: u.role, avatarUrl: u.avatarUrl, status: u.status, departmentId: u.departmentId,
        department: u.departmentId ? { id: u.departmentId, name: deptName(u.departmentId) } : null,
        managedDepartments: u.role === 'DEPARTMENT_LEADER' && u.departmentId ? [{ id: u.departmentId, name: deptName(u.departmentId) }] : [],
        permissions: permissionsFor(u.role), membershipExpiry: u.membershipExpiry, cardStatus: u.cardStatus,
        isCardReplacementRequested: u.isCardReplacementRequested, isPartner: u.isPartner, canManagePartnerships: !!u.canManagePartnerships,
        pastorModules: db().pastorModules.filter((m) => m.pastorId === u.id).map((m) => ({ id: m.id, moduleName: m.moduleKey })),
    };
}

export function demoLoginPayload(userId: string) {
    const u = db().users.find((x) => x.id === userId);
    if (!u) throw new Error(`Unknown demo persona ${userId}`);
    return sessionUser(u);
}

// ---------- Dashboard ----------

function dashboardSync(query: Row) {
    const user = me();
    const s = db();
    const leaderOrAdmin = isAdmin(user) || isPastor(user) || user.role === 'DEPARTMENT_LEADER';
    const scope = (isAdmin(user) || isPastor(user)) ? (query.departmentId || null) : user.departmentId;
    const inScope = (row: Row) => !scope || row.departmentId === scope;
    const partnership = live(s.partnerships).find((p) => p.userId === user.id);
    const account = scope
        ? accountFor(scope)
        : isAdmin(user) || isPastor(user)
            ? s.accounts.reduce((acc, a) => ({ ...acc, balance: acc.balance + a.balance, totalIncome: acc.totalIncome + a.totalIncome, totalExpenditure: acc.totalExpenditure + a.totalExpenditure }), { id: 'GLOBAL', balance: 0, totalIncome: 0, totalExpenditure: 0 })
            : null;
    const content = (kind: ContentKind) => visible(kind, user).filter((r) => !scope || r.departmentId === scope || r.isMajor || r.isGlobal || (r.approvals || []).some((a: Row) => a.userId === user.id));

    return {
        projects: content('projects'),
        events: content('events'),
        plans: content('plans'),
        meetings: user.role === 'MEMBER' ? [] : content('meetings'),
        announcements: content('announcements'),
        departments: s.departments.map((d) => ({ id: d.id, name: d.name })),
        pendingUsers: isAdmin(user) ? s.users.filter((u) => !u.deletedAt && (u.status === 'PENDING' || u.isCardReplacementRequested || u.deletionRequested)).map(publicUser) : [],
        baptisms: (leaderOrAdmin ? live(s.baptisms) : live(s.baptisms).filter((b) => b.userId === user.id)).map(withRefs),
        children: (leaderOrAdmin ? live(s.children) : live(s.children).filter((c) => c.parentId === user.id)).map(withRefs),
        ministrySettings: s.settings,
        affirmation: s.affirmation,
        devotion: todaysDevotion() ?? null,
        isPartner: !!user.isPartner,
        partnership: partnership ?? null,
        account: leaderOrAdmin ? account : null,
        transactions: leaderOrAdmin ? live(s.transactions).filter((t) => (isAdmin(user) || isPastor(user)) ? inScope(t) : t.departmentId === user.departmentId).map(withRefs) : [],
        allPartnerships: isAdmin(user) ? live(s.partnerships).map(withRefs) : [],
        globalMetrics: isAdmin(user) ? {
            totalUsers: s.users.length,
            totalPartners: s.users.filter((u) => u.isPartner).length,
            pendingApprovals: s.transactions.filter((t) => t.status !== 'APPROVED' && t.type === 'WITHDRAWAL').length,
            pendingDedications: s.children.filter((c) => !c.isDedicated).length,
        } : null,
        auditLogs: isAdmin(user) ? s.auditLogs.slice(0, 20).map((l) => ({ ...l, actor: brief(l.actorId) })) : [],
        departmentMembers: leaderOrAdmin ? s.users.filter((u) => !u.deletedAt && inScope(u)).map(publicUser) : [],
        repairs: leaderOrAdmin ? live(s.repairs).filter((r) => isAdmin(user) || isPastor(user) || r.departmentId === user.departmentId).map(withRefs) : [],
        reports: leaderOrAdmin ? s.reports.filter((r) => isAdmin(user) || isPastor(user) || r.departmentId === user.departmentId).map(withRefs) : [],
        appointments: live(s.appointments).filter((a) => leaderOrAdmin && !(user.role === 'DEPARTMENT_LEADER') ? (a.targetId === user.id || isAdmin(user) || a.status === 'PENDING') : a.memberId === user.id).map(withRefs),
    };
}

function syncStream(module: string) {
    const user = me();
    const s = db();
    const streams: Record<string, () => Row[]> = {
        events: () => visible('events', user, true),
        announcements: () => visible('announcements', user, true),
        plans: () => visible('plans', user, true),
        meetings: () => user.role === 'MEMBER' ? [] : visible('meetings', user, true),
        projects: () => visible('projects', user, true),
        partnerships: () => (isAdmin(user) || isPastor(user) ? s.partnerships : s.partnerships.filter((p) => p.userId === user.id)).map(withRefs),
        messages: () => s.messages.filter((m) => m.chatType !== 'PRIVATE' || m.senderId === user.id || m.receiverId === user.id).map(withRefs),
        members: () => s.users.filter((u) => isAdmin(user) || isPastor(user) || u.departmentId === user.departmentId).map(publicUser),
        devotions: () => s.devotions,
        baptisms: () => s.baptisms.map(withRefs),
        children: () => s.children.map(withRefs),
        finance: () => s.transactions.filter((t) => isAdmin(user) || isPastor(user) || t.departmentId === user.departmentId).map(withRefs),
        repairs: () => s.repairs.map(withRefs),
        appointments: () => s.appointments.map(withRefs),
        reports: () => s.reports.map(withRefs),
        support_requests: () => s.supportRequests.map(withRefs),
        audit_logs: () => s.auditLogs.map((l) => ({ ...l, actor: brief(l.actorId) })),
    };
    const data = streams[module]?.() ?? [];
    return { module, timestamp: now(), count: data.length, data };
}

// ---------- Router ----------

type Handler = (ctx: { params: Record<string, string>; query: Row; body: any; config: InternalAxiosRequestConfig }) => any;
const routes: { method: string; pattern: RegExp; keys: string[]; handler: Handler }[] = [];

function route(method: string, path: string, handler: Handler) {
    const keys: string[] = [];
    const pattern = new RegExp(`^${path.replace(/:(\w+)/g, (_m, key) => { keys.push(key); return '([^/]+)'; })}/?$`);
    routes.push({ method, pattern, keys, handler });
}

// Session and profile
route('GET', '/', () => ({ status: 'ALIVE', message: 'Demo kernel' }));
route('GET', '/auth/profile', () => publicUser(me()));
route('PATCH', '/auth/profile', ({ body }) => {
    const user = me();
    const allowed = ['name', 'avatarUrl', 'gender', 'dob', 'phoneNumber', 'deletionRequested'];
    for (const key of allowed) if (key in (body || {})) user[key] = body[key];
    user.updatedAt = now();
    save();
    return publicUser(user);
});
route('POST', '/upload', ({ body }) => {
    const file = body instanceof FormData ? [...body.values()].find((v) => v instanceof Blob) : null;
    return { url: file ? URL.createObjectURL(file as Blob) : '' };
});

// Departments
route('GET', '/departments', () => db().departments.map((d) => ({ ...d, _count: { leaders: d.leaders.length } })));
route('GET', '/departments/:id', ({ params }) => {
    const d = db().departments.find((x) => x.id === params.id);
    if (!d) throw new DemoError(404, 'Department not found.');
    return { ...d, meetings: live(db().meetings).filter((m) => m.departmentId === d.id) };
});
route('POST', '/departments', ({ body }) => {
    const row = { id: nextId('dept'), name: String(body?.name || 'New Department'), description: body?.description || '', leaderId: null, leaders: [], createdAt: now(), updatedAt: now(), version: 0 };
    db().departments.push(row);
    save();
    return row;
});

// Dashboards and sync
route('GET', '/dashboard/sync', ({ query }) => dashboardSync(query));
route('GET', '/sync/:module', ({ params }) => syncStream(params.module));
route('GET', '/dashboard/health', () => {
    const s = db();
    return {
        success: true,
        data: {
            inventory: { totalUsers: s.users.length, activeUsers: s.users.filter((u) => u.status === 'ACTIVE').length, targetScale: 600, status: 'SCALING' },
            performance: { latency: 42, syncSuccessRate: 99.2, failureRate: 0.2, uptime: '99.98%' },
            telemetry: { dailySyncEvents: 318, lastAudit: s.auditLogs[0]?.createdAt, recentAudits: s.auditLogs.slice(0, 10).map((l) => ({ ...l, actor: brief(l.actorId) })) },
        },
    };
});
route('GET', '/dashboard/governance', () => {
    const s = db();
    const trends = Array.from({ length: 7 }, (_v, i) => {
        const d = new Date(Date.now() - (6 - i) * 86400000);
        return { date: d.toLocaleDateString(undefined, { weekday: 'short' }), count: 20 + ((i * 37) % 25) };
    });
    return {
        demographics: { totalMembers: s.users.length, activePartners: s.users.filter((u) => u.isPartner).length },
        finance: { totalInflow: s.accounts.reduce((sum, a) => sum + a.totalIncome, 0) },
        operations: { pendingApprovals: s.events.filter((e) => e.approvalStatus === 'PENDING_APPROVAL').length + s.baptisms.filter((b) => b.status !== 'COMPLETED').length },
        trends,
        health: 'STABLE',
    };
});

// Content
for (const kind of Object.values(CONTENT)) {
    route('GET', `/${kind}`, ({ query }) => {
        const rows = visible(kind, me());
        if (kind === 'announcements' && String(query.isGlobal) === 'true') return rows.filter((r) => r.isGlobal && r.status === 'PUBLISHED');
        return rows;
    });
    route('GET', `/${kind}/:id`, ({ params }) => withRefs(findRow(db()[kind], params.id)));
    route('POST', `/${kind}`, ({ body }) => createContent(kind, body));
    route('PATCH', `/${kind}/:id`, ({ params, body }) => updateContent(kind, params.id, body));
    route('PUT', `/${kind}/:id`, ({ params, body }) => updateContent(kind, params.id, body));
    route('DELETE', `/${kind}/:id`, ({ params }) => deleteContent(kind, params.id));
    route('POST', `/${kind}/:id/approve`, ({ params }) => approveContent(kind, params.id));
    route('PATCH', `/${kind}/:id/status`, ({ params, body }) => setContentStatus(kind, params.id, body?.approvalStatus || body?.status));
}
route('GET', '/events/department/:id', ({ params }) => visible('events', me()).filter((e) => e.departmentId === params.id));

// Devotions
route('GET', '/devotions/authored/me', () => ({ success: true, data: db().devotions.filter((d) => d.authorId === me().id) }));
route('POST', '/devotions', ({ body }) => {
    const user = me();
    const existing = todaysDevotion();
    const fields = { title: body?.title, content: body?.content, themeOfMonth: body?.themeOfMonth, themeOfYear: body?.themeOfYear };
    const devotion = existing
        ? Object.assign(existing, fields, { updatedAt: now() })
        : { id: nextId('dev'), ...fields, date: now(), authorId: user.id, interactions: [], createdAt: now(), updatedAt: now(), version: 0 };
    if (!existing) db().devotions.unshift(devotion);
    audit('DEVOTION_PUBLISHED', 'DEVOTION', devotion.id);
    save();
    return { success: true, devotion, affirmation: db().affirmation };
});
route('POST', '/devotions/:id/interact', ({ params, body }) => {
    const user = me();
    const devotion = db().devotions.find((d) => d.id === params.id);
    if (!devotion) throw new DemoError(404, 'Devotion not found.');
    const list: Row[] = devotion.interactions || [];
    const index = list.findIndex((i) => i.userId === user.id && i.type === body?.type && i.value === body?.value);
    if (index >= 0) list.splice(index, 1);
    else list.push({ userId: user.id, type: body?.type, value: body?.value });
    devotion.interactions = list;
    save();
    return { success: true };
});

// Members and registry
route('GET', '/users/search-members', ({ query }) => {
    const q = String(query.query || query.q || '').toLowerCase();
    return db().users.filter((u) => !u.deletedAt && u.name.toLowerCase().includes(q)).slice(0, 20).map((u) => brief(u.id));
});
route('PATCH', '/users/:id/status', ({ params, body }) => {
    const u = findRow(db().users, params.id);
    if (body?.status === 'REJECTED' && u.deletionRequested) u.deletedAt = now();
    u.status = body?.status === 'REJECTED' ? 'REJECTED' : body?.status || u.status;
    u.updatedAt = now();
    audit('USER_STATUS_CHANGED', 'USER', u.id);
    save();
    return { message: `Status updated to ${u.status}`, user: publicUser(u) };
});
route('PATCH', '/users/:id/mark-paid', ({ params, body }) => {
    const u = findRow(db().users, params.id);
    u.isCardPaid = !!(body?.isPaid ?? body?.isCardPaid);
    u.updatedAt = now();
    save();
    return { message: 'Payment updated.', user: publicUser(u) };
});
route('POST', '/users/:id/card-renewal/approve', ({ params, body }) => {
    const u = findRow(db().users, params.id);
    Object.assign(u, { isCardReplacementRequested: false, cardStatus: 'ACTIVE', membershipExpiry: new Date(Date.now() + 365 * 86400000).toISOString(), membershipNumber: body?.newMembershipNumber || u.membershipNumber, updatedAt: now() });
    save();
    return { message: 'Card renewed.', user: publicUser(u) };
});
route('POST', '/users/card-renewal/request', () => {
    const u = me();
    u.isCardReplacementRequested = true;
    save();
    return { message: 'Renewal requested.' };
});
route('POST', '/users/technical/intervention/:id', ({ params, body }) => {
    const u = findRow(db().users, params.id);
    const action = String(body?.action || '');
    if (action === 'ACTIVATE') u.status = 'ACTIVE';
    else if (action === 'SUSPEND') Object.assign(u, { status: 'SUSPENDED', isSuspended: true });
    else if (action === 'UNSUSPEND') Object.assign(u, { status: 'ACTIVE', isSuspended: false });
    else if (action === 'RESET_STRIKES') u.wrongdoingCount = 0;
    else if (action === 'DEMOTE') u.role = 'MEMBER';
    else if (action === 'TOGGLE_PARTNER') u.isPartner = !u.isPartner;
    else if (action.startsWith('MAKE_')) {
        u.role = action.slice(5);
        if (body?.departmentId) u.departmentId = body.departmentId;
    } else throw new DemoError(400, 'Invalid intervention code.');
    u.updatedAt = now();
    audit(`INTERVENTION_${action}`, 'USER', u.id);
    save();
    return { message: 'Intervention applied.', user: publicUser(u) };
});
route('DELETE', '/users/technical/purge/:id', ({ params }) => {
    db().users = db().users.filter((u) => u.id !== params.id);
    save();
    return { message: 'User purged.' };
});
route('PATCH', '/users/technical/bio/:id', ({ params, body }) => {
    const u = findRow(db().users, params.id);
    Object.assign(u, clean(body), { updatedAt: now() });
    save();
    return { message: 'Bio repaired.', user: publicUser(u) };
});
route('POST', '/users/partnership/enroll', ({ body }) => {
    const user = me();
    const amount = Number(body?.amount) || 1000;
    let p = live(db().partnerships).find((x) => x.userId === user.id);
    if (!p) {
        p = { id: nextId('part'), userId: user.id, amount, frequency: 'MONTHLY', status: 'ACTIVE', balance: amount, paidAmount: 0, ledgers: [], createdAt: now(), updatedAt: now(), version: 0 };
        db().partnerships.unshift(p);
    } else Object.assign(p, { amount, status: 'ACTIVE', updatedAt: now() });
    user.isPartner = true;
    save();
    return { message: 'Welcome to the covenant partnership.', partnership: withRefs(p) };
});
route('GET', '/users/pastor/assigned-modules', ({ query }) => ({ success: true, data: db().pastorModules.filter((m) => m.pastorId === (query.userId || me().id)) }));
route('POST', '/users/pastor/modules/assign', ({ body }) => {
    const existing = db().pastorModules.find((m) => m.pastorId === body?.pastorId && m.moduleKey === body?.moduleKey);
    if (existing) return { success: true, data: existing };
    const row = { id: nextId('pm'), pastorId: body?.pastorId, moduleKey: body?.moduleKey, permissions: body?.permissions ?? [], createdAt: now(), updatedAt: now() };
    db().pastorModules.push(row);
    save();
    return { success: true, data: row };
});
route('DELETE', '/users/pastor/modules/revoke/:id', ({ params }) => {
    db().pastorModules = db().pastorModules.filter((m) => m.id !== params.id);
    save();
    return { success: true };
});

// Finance
route('POST', '/finance/income', ({ body }) => {
    const user = me();
    const departmentId = body?.departmentId || user.departmentId;
    const amount = Number(body?.amount);
    if (!departmentId) throw new DemoError(400, 'Choose a department for this entry.');
    if (!(amount > 0)) throw new DemoError(400, 'Enter an amount greater than zero.');
    const account = accountFor(departmentId);
    account.balance += amount;
    account.totalIncome += amount;
    const row = { id: nextId('tx'), accountId: account.id, departmentId, type: 'INCOME', amount, description: body?.description || 'Income', status: 'APPROVED', requestedById: user.id, approvals: [], date: now(), createdAt: now(), updatedAt: now(), version: 0 };
    db().transactions.unshift(row);
    save();
    return { message: 'Income recorded.', transaction: withRefs(row) };
});
route('POST', '/finance/withdraw', ({ body }) => {
    const user = me();
    const departmentId = body?.departmentId || user.departmentId;
    const amount = Number(body?.amount);
    if (!departmentId) throw new DemoError(400, 'Choose a department for this request.');
    if (!(amount > 0)) throw new DemoError(400, 'Enter an amount greater than zero.');
    if (accountFor(departmentId).balance < amount) throw new DemoError(400, 'Insufficient funds in this department account.');
    const row = { id: nextId('tx'), accountId: accountFor(departmentId).id, departmentId, type: 'WITHDRAWAL', amount, description: body?.description || 'Withdrawal', status: 'PENDING_LEADER_APPROVAL', requestedById: user.id, approvals: [], date: now(), createdAt: now(), updatedAt: now(), version: 0 };
    db().transactions.unshift(row);
    save();
    return { message: 'Withdrawal requested.', transaction: withRefs(row) };
});
route('POST', '/finance/:id/approve', ({ params }) => {
    const user = me();
    const t = findRow(db().transactions, params.id);
    if (t.status === 'APPROVED' || t.status === 'REJECTED') throw new DemoError(400, 'This transaction is already closed.');
    if ((t.approvals || []).some((a: Row) => a.userId === user.id)) throw new DemoError(400, 'You have already signed this withdrawal.');
    t.approvals = [...(t.approvals || []), { userId: user.id, role: user.role === 'SUPER_ADMIN' ? 'BISHOP' : user.role, approved: true }];
    const bishopSigned = t.approvals.some((a: Row) => a.role === 'BISHOP' || a.role === 'WATUA');
    if (bishopSigned) {
        const account = accountFor(t.departmentId);
        if (account.balance < t.amount) throw new DemoError(400, 'Insufficient funds in this department account.');
        account.balance -= t.amount;
        account.totalExpenditure += t.amount;
        t.status = 'APPROVED';
    } else t.status = 'PENDING_BISHOP_APPROVAL';
    t.updatedAt = now();
    save();
    return { message: 'Signature recorded.', transaction: withRefs(t) };
});

// Baptisms and dedications
const BAPTISM_FLOW = ['PENDING_PASTOR_APPROVAL', 'ADMIN_PAYMENT_VERIFICATION', 'BISHOP_APPROVED', 'COMPLETED'];
const DEDICATION_FLOW = ['PENDING_DEDICATION', 'ADMIN_PAYMENT_VERIFICATION', 'BISHOP_RITE_PENDING', 'DEDICATED'];
function advance(flow: string[], current: string, next: string) {
    if (next === 'REJECTED' || next === 'CANCELED') return;
    const from = flow.indexOf(current);
    const to = flow.indexOf(next);
    if (to === -1 || to > from + 1) throw new DemoError(400, 'Steps must be completed in order.');
}
route('GET', '/workflows/baptism', () => live(db().baptisms).map(withRefs));
route('POST', '/workflows/baptism', () => {
    const user = me();
    if (live(db().baptisms).some((b) => b.userId === user.id && !['COMPLETED', 'REJECTED'].includes(b.status))) throw new DemoError(409, 'You already have a baptism request in progress.');
    const row = { id: nextId('bap'), userId: user.id, status: 'PENDING_PASTOR_APPROVAL', isPaid: false, createdAt: now(), updatedAt: now(), version: 0 };
    db().baptisms.unshift(row);
    save();
    return { message: 'Baptism request submitted.', baptism: withRefs(row) };
});
route('PATCH', '/workflows/baptism/:id/status', ({ params, body }) => {
    const b = findRow(db().baptisms, params.id);
    advance(BAPTISM_FLOW, b.status, body?.status);
    Object.assign(b, { status: body?.status, updatedAt: now() }, body?.baptismCardNumber ? { baptismCardNumber: body.baptismCardNumber } : {}, body?.isPaid ? { isPaid: true, paymentReference: body.paymentReference } : {});
    save();
    return { message: 'Baptism updated.', baptism: withRefs(b) };
});
route('PATCH', '/workflows/dedication/:id/status', ({ params, body }) => {
    const c = findRow(db().children, params.id);
    const next = body?.workflowStatus || body?.status;
    advance(DEDICATION_FLOW, c.workflowStatus, next);
    Object.assign(c, { workflowStatus: next, isDedicated: next === 'DEDICATED', updatedAt: now() }, body?.isDedicationPaid || body?.isPaid ? { isDedicationPaid: true } : {});
    save();
    return { message: 'Dedication updated.', child: withRefs(c) };
});
route('GET', '/children/all', () => {
    const data = live(db().children).map(withRefs);
    return { data, meta: { total: data.length, page: 1, limit: 200 } };
});
route('GET', '/children', () => live(db().children).filter((c) => c.parentId === me().id).map(withRefs));
route('POST', '/children', ({ body }) => {
    const user = me();
    const row = { id: nextId('child'), name: body?.name, dob: body?.dob, gender: body?.gender, branch: body?.branch || 'HQ', parentId: user.id, departmentId: user.departmentId, status: 'ACTIVE', workflowStatus: body?.isDedicated ? 'DEDICATED' : 'PENDING_DEDICATION', isDedicated: !!body?.isDedicated, dedicationNumber: `DED-DEMO-${db().seq}`, createdAt: now(), updatedAt: now(), version: 0 };
    db().children.unshift(row);
    save();
    return { message: 'Child registered.', child: withRefs(row) };
});

// Repairs
route('GET', '/repairs', () => live(db().repairs).map(withRefs));
route('POST', '/repairs', ({ body }) => {
    const user = me();
    const row = { id: nextId('rep'), departmentId: body?.departmentId || 'demo-dept-tech', instrumentName: body?.instrumentName, problemDescription: body?.problemDescription, estimatedCost: Number(body?.estimatedCost) || 0, budgetSource: body?.budgetSource || 'DEPARTMENT', status: 'PENDING_PASTOR_1', requesterId: user.id, approvals: [], createdAt: now(), updatedAt: now(), version: 0 };
    db().repairs.unshift(row);
    save();
    return { message: 'Repair request submitted.', repair: withRefs(row) };
});
route('PATCH', '/repairs/:id/approve', ({ params }) => {
    const user = me();
    const r = findRow(db().repairs, params.id);
    if ((r.approvals || []).some((a: Row) => a.userId === user.id)) throw new DemoError(400, 'You have already signed this repair.');
    const steps: Record<string, [string, string[]]> = {
        PENDING_PASTOR_1: ['PENDING_PASTOR_2', ['PASTOR']],
        PENDING_PASTOR_2: ['PENDING_ADMIN', ['PASTOR']],
        PENDING_ADMIN: ['PENDING_BISHOP', ['SYSTEM_ADMIN', 'SUPER_ADMIN']],
        PENDING_BISHOP: ['APPROVED', ['SUPER_ADMIN']],
    };
    const step = steps[r.status];
    if (!step || !step[1].includes(user.role)) throw new DemoError(403, 'This repair is waiting on a different approver.');
    r.status = r.status === 'PENDING_ADMIN' && user.role === 'SUPER_ADMIN' ? 'APPROVED' : step[0];
    r.approvals = [...(r.approvals || []), { userId: user.id, role: user.role, approved: true }];
    r.updatedAt = now();
    save();
    return { message: 'Repair approved.', repair: withRefs(r) };
});
route('DELETE', '/repairs/:id', ({ params }) => {
    const r = findRow(db().repairs, params.id);
    r.deletedAt = now();
    r.updatedAt = now();
    save();
    return { message: 'Deleted.' };
});

// Reports
route('GET', '/reports', ({ query }) => db().reports.filter((r) => !query.departmentId || r.departmentId === query.departmentId).map(withRefs));
route('POST', '/reports', ({ body }) => {
    const user = me();
    const field = (key: string) => (body instanceof FormData ? body.get(key) : body?.[key]);
    const file = body instanceof FormData ? body.get('report') : null;
    const departmentId = String(field('departmentId') || user.departmentId || '');
    if (!departmentId) throw new DemoError(400, 'Choose a department for this report.');
    const row = { id: nextId('rpt'), departmentId, type: String(field('type') || 'MONTHLY'), content: String(field('content') || ''), fileName: file instanceof File ? file.name : null, submittedById: user.id, createdAt: now(), updatedAt: now() };
    db().reports.unshift(row);
    save();
    return { message: 'Report submitted.', report: withRefs(row) };
});
route('GET', '/reports/:id/download', ({ params }) => {
    const r = db().reports.find((x) => x.id === params.id);
    return new Blob([`Prayer Palace demo report\n\n${deptName(r?.departmentId) ?? ''}\n${r?.content ?? ''}\n\nThis is sample data.`], { type: 'text/plain' });
});

// Partnerships
route('GET', '/partnerships/all', () => live(db().partnerships).map(withRefs));
route('POST', '/partnerships/:id/ledger', ({ params, body }) => {
    const p = findRow(db().partnerships, params.id);
    const amount = Number(body?.amount);
    if (!(amount > 0)) throw new DemoError(400, 'Enter an amount greater than zero.');
    const ledger = { id: nextId('ledger'), partnershipId: p.id, amount, transactionType: 'CREDIT', paymentMethod: body?.paymentMethod || 'MPESA', referenceCode: body?.referenceCode || `DEMO${db().seq}`, status: 'VERIFIED', date: now() };
    p.ledgers = [ledger, ...(p.ledgers || [])];
    Object.assign(p, { paidAmount: (p.paidAmount || 0) + amount, balance: Math.max(0, (p.balance || 0) - amount), lastPaymentDate: now(), updatedAt: now() });
    save();
    return { partnership: withRefs(p), ledger };
});
route('PATCH', '/partnerships/:id', ({ params, body }) => {
    const p = findRow(db().partnerships, params.id);
    p.amount = Number(body?.amount) || p.amount;
    p.updatedAt = now();
    save();
    return withRefs(p);
});

// Appointments
route('GET', '/appointments/all', () => live(db().appointments).map(withRefs));
route('POST', '/appointments', ({ body }) => {
    const user = me();
    const targetRole = body?.targetRole === 'BISHOP' ? 'SUPER_ADMIN' : body?.targetRole || 'PASTOR';
    const target = db().users.find((u) => u.id === body?.targetId) ?? db().users.find((u) => u.role === targetRole);
    const row = { id: nextId('appt'), memberId: user.id, targetRole, targetId: target?.id ?? null, type: body?.type || 'COUNSELLING', reason: body?.reason || '', status: 'PENDING', preferredDate: body?.preferredDate || now(), preferredTime: body?.preferredTime || '10:00', createdAt: now(), updatedAt: now(), version: 0 };
    db().appointments.unshift(row);
    save();
    return { message: 'Appointment requested.', appointment: withRefs(row) };
});
route('PATCH', '/appointments/:id/status', ({ params, body }) => {
    const a = findRow(db().appointments, params.id);
    Object.assign(a, { status: body?.status, adminNotes: body?.adminNotes ?? a.adminNotes, approvedDate: body?.approvedDate ?? a.approvedDate, approvedTime: body?.approvedTime ?? a.approvedTime, updatedAt: now() });
    save();
    return { message: 'Appointment updated.', appointment: withRefs(a) };
});

// Support requests
route('GET', '/support', () => db().supportRequests.map((r) => ({ ...withRefs(r), event: db().events.find((e) => e.id === r.eventId) ?? null })));
route('POST', '/support', ({ body }) => {
    const user = me();
    const row = { id: nextId('sup'), requesterId: user.id, eventId: body?.eventId || null, title: body?.title, description: body?.description, amountRequired: Number(body?.amountRequired) || 0, proofImageUrl: body?.proofImageUrl ?? null, status: 'OPEN', category: body?.category || 'EVENT_FUNDING', createdAt: now(), updatedAt: now() };
    db().supportRequests.unshift(row);
    save();
    return withRefs(row);
});
route('PATCH', '/support/:id/fund', ({ params }) => {
    const r = findRow(db().supportRequests, params.id);
    Object.assign(r, { status: 'FUNDED', updatedAt: now() });
    save();
    return withRefs(r);
});

// Messages
route('GET', '/messages', ({ query }) => {
    const user = me();
    const rows = db().messages.filter((m) => !m.isDeleted).filter((m) => {
        if (query.chatType === 'PRIVATE') return m.chatType === 'PRIVATE' && [m.senderId, m.receiverId].includes(user.id) && [m.senderId, m.receiverId].includes(query.receiverId);
        if (query.departmentId) return m.departmentId === query.departmentId;
        if (query.chatType) return m.chatType === query.chatType;
        return true;
    });
    return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(withRefs);
});
route('POST', '/messages', ({ body }) => {
    const user = me();
    const row = { id: nextId('msg'), content: body?.content || '', senderId: user.id, receiverId: body?.receiverId || null, departmentId: body?.departmentId || null, chatType: body?.chatType || (body?.receiverId ? 'PRIVATE' : body?.departmentId ? 'DEPARTMENT' : 'GLOBAL'), isEdited: false, isDeleted: false, createdAt: now(), updatedAt: now(), version: 0 };
    db().messages.push(row);
    save();
    return withRefs(row);
});
route('PATCH', '/messages/:id', ({ params, body }) => {
    const m = findRow(db().messages, params.id);
    if (m.senderId !== me().id) throw new DemoError(403, 'You can only edit your own messages.');
    Object.assign(m, { content: body?.content ?? m.content, isEdited: true, updatedAt: now() });
    save();
    return withRefs(m);
});
route('DELETE', '/messages/:id', ({ params }) => {
    const m = findRow(db().messages, params.id);
    if (m.senderId !== me().id) throw new DemoError(403, 'You can only delete your own messages.');
    Object.assign(m, { isDeleted: true, updatedAt: now() });
    save();
    return { message: 'Deleted.' };
});

// Notifications, settings, permissions, recovery, search
route('GET', '/notifications/user/:id', ({ params }) => db().notifications.filter((n) => n.userId === params.id || n.userId === '*'));
route('PATCH', '/notifications/:id/read', ({ params }) => {
    const n = db().notifications.find((x) => x.id === params.id);
    if (n) n.read = true;
    save();
    return { success: true };
});
route('GET', '/public/notifications', () => []);
route('GET', '/settings', () => db().settings);
route('PATCH', '/settings', ({ body }) => {
    Object.assign(db().settings, { themeOfYear: body?.themeOfYear ?? db().settings.themeOfYear, themeOfMonth: body?.themeOfMonth ?? db().settings.themeOfMonth, updatedAt: now() });
    save();
    return db().settings;
});
route('GET', '/settings/flags/check/:flag', () => ({ enabled: true }));

const PERMISSION_CODES = ['VIEW_GLOBAL_STATS', 'VIEW_FINANCIALS', 'MANAGE_DEPARTMENTS', 'VIEW_PERSONNEL', 'MANAGE_USERS', 'VIEW_USER_DETAILS', 'VIEW_PASTORAL_PORTAL', 'APPROVE_BAPTISM', 'APPROVE_DEDICATION', 'MANAGE_APPOINTMENTS', 'VIEW_DEPARTMENT', 'MANAGE_DEPARTMENT_PROJECTS', 'MANAGE_DEPARTMENT_EVENTS', 'MANAGE_DEPARTMENT_PLANS', 'CREATE_ANNOUNCEMENTS_LOCAL', 'CREATE_ANNOUNCEMENTS_GLOBAL', 'ACCESS_WATUA', 'VIEW_COVENANT_PARTNERSHIPS', 'MANAGE_PERMISSIONS', 'VIEW_SYSTEM_LOGS'];
route('GET', '/permissions', () => PERMISSION_CODES.map((code) => ({ id: `perm-${code}`, code, description: `Capability to ${code.toLowerCase().replace(/_/g, ' ')}` })));
route('GET', '/permissions/roles', () => ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'PASTOR', 'DEPARTMENT_LEADER', 'MEMBER', 'WATUA'].map((name) => ({
    id: `role-${name}`, name, description: `The ${name} role`,
    permissions: (name === 'WATUA' ? PERMISSION_CODES : permissionsFor(name)).map((code) => ({ id: `rp-${name}-${code}`, permissionId: `perm-${code}` })),
})));
route('PUT', '/permissions/roles/:id/permissions', () => ({ success: true }));
route('GET', '/permissions/audit-log', () => db().auditLogs.slice(0, 20).map((l) => ({ ...l, actor: brief(l.actorId) })));
route('GET', '/recovery/trash', () => [...db().events, ...db().projects, ...db().plans, ...db().announcements].filter((r) => r.deletedAt).map((r) => ({ id: r.id, title: r.title, type: r.date ? 'event' : r.budget !== undefined ? 'project' : r.content && r.priority ? 'announcement' : 'plan', deletedAt: r.deletedAt })));
route('POST', '/recovery/restore/:type/:id', ({ params }) => {
    for (const kind of Object.values(CONTENT)) {
        const row = db()[kind].find((r) => r.id === params.id);
        if (row) {
            delete row.deletedAt;
            row.updatedAt = now();
        }
    }
    save();
    return { message: 'Restored.' };
});
route('GET', '/search', ({ query }) => {
    const user = me();
    const q = String(query.q || '').toLowerCase();
    const match = (r: Row) => String(r.title || r.name || '').toLowerCase().includes(q);
    return {
        projects: visible('projects', user).filter(match).slice(0, 5),
        events: visible('events', user).filter(match).slice(0, 5),
        announcements: visible('announcements', user).filter(match).slice(0, 5),
        users: user.role === 'MEMBER' ? [] : db().users.filter(match).slice(0, 5).map((u) => brief(u.id)),
    };
});

// ---------- Axios adapter ----------

function parseRequest(config: InternalAxiosRequestConfig) {
    const url = new URL(config.url || '/', 'http://demo.local');
    const query: Row = Object.fromEntries(url.searchParams.entries());
    for (const [k, v] of Object.entries(config.params || {})) if (v !== undefined && v !== null) query[k] = String(v);
    let body = config.data;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch {
            // Non-JSON bodies are passed through unchanged.
        }
    }
    return { method: (config.method || 'get').toUpperCase(), path: url.pathname, query, body };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function demoAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
    const { method, path, query, body } = parseRequest(config);
    await wait(method === 'GET' ? 60 : 180);
    const respond = (status: number, data: any): AxiosResponse => ({ data, status, statusText: status < 400 ? 'OK' : 'Error', headers: new AxiosHeaders(), config, request: {} });

    try {
        for (const r of routes) {
            if (r.method !== method) continue;
            const match = r.pattern.exec(path);
            if (!match) continue;
            const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(match[i + 1])]));
            return respond(method === 'POST' ? 201 : 200, r.handler({ params, query, body, config }));
        }
        return respond(200, method === 'GET' ? [] : { success: true });
    } catch (err) {
        const status = err instanceof DemoError ? err.status : 500;
        const message = err instanceof Error ? err.message : 'Demo error';
        const response = respond(status, { error: message });
        throw new AxiosError(message, status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST, config, {}, response);
    }
}
