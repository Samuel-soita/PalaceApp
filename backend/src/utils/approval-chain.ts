import { AppError } from './errors.js';
import { emitNotification } from './socket.js';
import { bishopRoleApproved } from './approval-utils.js';

/**
 * Leadership approval chain for events, plans, projects and announcements:
 * the creator picks 2 pastors, the Bishop is always added, and only those
 * assigned approvers may sign. The item is approved once the Bishop and
 * 2 pastors have signed.
 */
const APPROVAL_MODELS = {
    event: { model: 'eventApproval', fk: 'eventId' },
    plan: { model: 'planApproval', fk: 'planId' },
    project: { model: 'projectApproval', fk: 'projectId' },
    announcement: { model: 'announcementApproval', fk: 'announcementId' },
} as const;

export type ApprovalEntity = keyof typeof APPROVAL_MODELS;

export interface ApprovalRow {
    userId: string;
    role: string;
    approved: boolean;
}

export const REQUIRED_PASTOR_APPROVALS = 2;

/** Creators whose content is not auto-approved must nominate exactly 2 distinct pastors. */
export function assertPastorSelection(autoApprove: boolean, pastorIds: unknown, message = 'You must select exactly 2 Pastors to approve this item.') {
    if (autoApprove) return;
    const ids = Array.isArray(pastorIds) ? new Set(pastorIds.filter((id) => typeof id === 'string' && id)) : new Set();
    if (ids.size !== REQUIRED_PASTOR_APPROVALS) throw new AppError(message, 400);
}

export function approvalRoleFor(userRole: string): string {
    if (userRole === 'SUPER_ADMIN') return 'BISHOP';
    if (userRole === 'PASTOR' || userRole === 'ASSOCIATE_PASTOR') return 'PASTOR';
    return userRole;
}

export function approvalQuorumMet(rows: ApprovalRow[]): boolean {
    const signed = rows.filter((r) => r.approved);
    return bishopRoleApproved(signed) && signed.filter((r) => r.role === 'PASTOR').length >= REQUIRED_PASTOR_APPROVALS;
}

/**
 * Decides whether `user` may sign. Assigned approvers update their own row.
 * Items created before assignments existed (no pending pastor rows / no bishop
 * row) still accept the missing signatures so they are not stuck forever.
 */
export function resolveApprover(rows: ApprovalRow[], user: { id: string; role: string }): { kind: 'update' } | { kind: 'create'; role: string } {
    const mine = rows.find((r) => r.userId === user.id);
    if (mine) {
        if (mine.approved) throw new AppError('You have already approved this item.', 400);
        return { kind: 'update' };
    }

    const role = approvalRoleFor(user.role);
    if (role === 'BISHOP' && !rows.some((r) => r.role === 'BISHOP')) {
        return { kind: 'create', role };
    }
    if (role === 'PASTOR') {
        const pendingPastors = rows.some((r) => r.role === 'PASTOR' && !r.approved);
        const signedPastors = rows.filter((r) => r.role === 'PASTOR' && r.approved).length;
        if (!pendingPastors && signedPastors < REQUIRED_PASTOR_APPROVALS) {
            return { kind: 'create', role };
        }
    }
    throw new AppError('Only the assigned pastors and the Bishop can approve this item.', 403);
}

export async function createApprovalChain(
    tx: any,
    entity: ApprovalEntity,
    entityId: string,
    pastorIds: unknown,
    notification: { title: string; message: string }
): Promise<string[]> {
    const { model, fk } = APPROVAL_MODELS[entity];
    const requested = [...new Set((Array.isArray(pastorIds) ? pastorIds : []).filter((id): id is string => typeof id === 'string' && id.length > 0))];

    const pastors = requested.length
        ? await tx.user.findMany({
            where: { id: { in: requested }, role: { in: ['PASTOR', 'ASSOCIATE_PASTOR'] }, deletedAt: null },
            select: { id: true },
        })
        : [];
    if (pastors.length !== requested.length) {
        throw new AppError('Selected approvers must be active pastors.', 400);
    }

    const bishop = await tx.user.findFirst({
        where: { role: 'SUPER_ADMIN', deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
    });

    const assignments = pastors.map((p: { id: string }) => ({ [fk]: entityId, userId: p.id, role: 'PASTOR' }));
    if (bishop) assignments.push({ [fk]: entityId, userId: bishop.id, role: 'BISHOP' });
    if (assignments.length === 0) return [];

    await tx[model].createMany({ data: assignments, skipDuplicates: true });
    await tx.notification.createMany({
        data: assignments.map((a: any) => ({ userId: a.userId, title: notification.title, message: notification.message })),
    });
    return assignments.map((a: any) => a.userId);
}

export async function recordApproval(
    tx: any,
    entity: ApprovalEntity,
    entityId: string,
    user: { id: string; role: string }
): Promise<{ approvals: ApprovalRow[]; quorumMet: boolean }> {
    const { model, fk } = APPROVAL_MODELS[entity];
    const rows: ApprovalRow[] = await tx[model].findMany({ where: { [fk]: entityId } });
    const decision = resolveApprover(rows, user);

    if (decision.kind === 'update') {
        const { count } = await tx[model].updateMany({
            where: { [fk]: entityId, userId: user.id, approved: false },
            data: { approved: true },
        });
        if (count === 0) throw new AppError('You have already approved this item.', 400);
    } else {
        await tx[model].create({ data: { [fk]: entityId, userId: user.id, role: decision.role, approved: true } });
    }

    // Delta sync keys off the parent's updatedAt, so signatures must touch it.
    await tx[entity].update({ where: { id: entityId }, data: { updatedAt: new Date() } });

    const approvals: ApprovalRow[] = await tx[model].findMany({ where: { [fk]: entityId } });
    return { approvals, quorumMet: approvalQuorumMet(approvals) };
}

const LINKED_ANNOUNCEMENT = {
    event: { fk: 'eventId', prefix: 'NEW EVENT' },
    project: { fk: 'projectId', prefix: 'NEW PROJECT' },
} as const;

/**
 * Events and projects post a "NEW EVENT: X" / "NEW PROJECT: X" announcement that waits on
 * the parent's approval. Older rows were not linked by id, so they are matched by title.
 */
export async function publishLinkedAnnouncement(tx: any, parent: 'event' | 'project', record: { id: string; title: string; departmentId: string | null }) {
    const { fk, prefix } = LINKED_ANNOUNCEMENT[parent];
    await tx.announcement.updateMany({
        where: {
            status: 'PENDING',
            deletedAt: null,
            OR: [
                { [fk]: record.id },
                { [fk]: null, title: `${prefix}: ${record.title.toUpperCase()}`, departmentId: record.departmentId },
            ],
        },
        data: { status: 'PUBLISHED' },
    });
}

const FORCE_STATUS_ROLES = ['SUPER_ADMIN', 'WATUA'];

/** Direct status changes: Bishop/Watua may override; assigned approvers may only reject. */
export async function assertCanSetApprovalStatus(db: any, entity: ApprovalEntity, entityId: string, user: { id: string; role: string }, status: string) {
    if (FORCE_STATUS_ROLES.includes(user.role)) return;
    if (status === 'APPROVED') {
        throw new AppError('Approval requires the Bishop and 2 assigned pastors. Use Approve instead.', 403);
    }
    const { model, fk } = APPROVAL_MODELS[entity];
    const assigned = await db[model].findFirst({ where: { [fk]: entityId, userId: user.id }, select: { id: true } });
    if (!assigned) throw new AppError('Only the assigned pastors and the Bishop can reject this item.', 403);
}

export function assertAwaitingApproval(status: string | null | undefined) {
    if (status && !['PENDING', 'PENDING_APPROVAL'].includes(status)) {
        throw new AppError('This item is no longer awaiting approval.', 400);
    }
}

export function notifyApprovers(userIds: string[], notification: { title: string; message: string }) {
    for (const userId of userIds) emitNotification(userId, notification);
}
