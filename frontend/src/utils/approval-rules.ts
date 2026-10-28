const PRIVILEGED_CREATORS = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY'] as const;

export function canBypassPastorAuthorization(role?: string): boolean {
    return PRIVILEGED_CREATORS.includes(role as typeof PRIVILEGED_CREATORS[number]);
}

export function pastorAuthorizationBlocked(role: string | undefined, pastorIds: string[]): boolean {
    if (canBypassPastorAuthorization(role)) return false;
    return pastorIds.length !== 2;
}

type ApprovalSignature = { userId: string; role?: string; approved?: boolean };
type ApprovableItem = { approvals?: ApprovalSignature[] | null };

const PENDING_STATUSES = ['PENDING', 'PENDING_APPROVAL'];
const REQUIRED_PASTOR_APPROVALS = 2;

export function isAwaitingApproval(status?: string | null): boolean {
    return PENDING_STATUSES.includes(status || '');
}

/** Mirrors the backend rule: assigned approvers sign their own row; legacy items accept missing Bishop/pastor signatures. */
export function canSignApproval(item: ApprovableItem, user?: { id: string; role: string } | null): boolean {
    if (!user) return false;
    const approvals = item.approvals || [];
    const mine = approvals.find((a) => a.userId === user.id);
    if (mine) return !mine.approved;

    if (user.role === 'SUPER_ADMIN') return !approvals.some((a) => a.role === 'BISHOP');
    if (user.role === 'PASTOR' || user.role === 'ASSOCIATE_PASTOR') {
        const pendingPastors = approvals.some((a) => a.role === 'PASTOR' && !a.approved);
        const signedPastors = approvals.filter((a) => a.role === 'PASTOR' && a.approved).length;
        return !pendingPastors && signedPastors < REQUIRED_PASTOR_APPROVALS;
    }
    return false;
}

/** Watua may override the approval chain directly. */
export function canOverrideApproval(role?: string): boolean {
    return role === 'WATUA';
}

export function isAssignedApprover(item: ApprovableItem, userId?: string): boolean {
    return !!userId && (item.approvals || []).some((a) => a.userId === userId && !a.approved);
}

export function canSendChurchWideComms(role?: string): boolean {
    return ['SUPER_ADMIN', 'WATUA', 'SYSTEM_ADMIN', 'SECRETARY'].includes(role || '');
}
