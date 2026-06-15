const PRIVILEGED_CREATORS = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN'] as const;

export function canBypassPastorAuthorization(role?: string): boolean {
    return PRIVILEGED_CREATORS.includes(role as typeof PRIVILEGED_CREATORS[number]);
}

export function pastorAuthorizationBlocked(role: string | undefined, pastorIds: string[]): boolean {
    if (canBypassPastorAuthorization(role)) return false;
    return pastorIds.length !== 2;
}

export function canSendChurchWideComms(role?: string): boolean {
    return ['SUPER_ADMIN', 'WATUA', 'SYSTEM_ADMIN', 'SECRETARY'].includes(role || '');
}
