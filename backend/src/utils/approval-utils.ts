/** Roles that can publish/approve content without multi-signature workflow. */
export function canAutoPublishContent(role: string) {
    return ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY'].includes(role);
}

export function bishopRoleApproved(approvals: Array<{ role: string }>) {
    return approvals.some((a) => a.role === 'BISHOP' || a.role === 'SUPER_ADMIN');
}
