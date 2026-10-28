/** Canonical pastor module keys and legacy aliases stored in the database. */
export const PASTOR_MODULE_ALIASES = {
    EventOversight: ['EventOversight', 'Event Oversight'],
    PartnershipManagement: ['PartnershipManagement', 'Partnership Management'],
    ChildDedication: ['ChildDedication', 'Child Dedication Registry', 'ChildDedicationRegistry'],
    DevotionPublishing: ['DevotionPublishing'],
    ProjectOversight: ['ProjectOversight', 'Project Oversight'],
    MemberRegistration: ['MemberRegistration'],
} as const;

export type PastorModuleKey = keyof typeof PASTOR_MODULE_ALIASES;

export const PASTOR_MODULE_KEYS = Object.keys(PASTOR_MODULE_ALIASES) as PastorModuleKey[];

const PRIVILEGED_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'WATUA', 'BISHOP'];

export function hasPastorModule(user: { role?: string; pastorModules?: Array<{ moduleName?: string; moduleKey?: string }> } | null | undefined, key: PastorModuleKey): boolean {
    if (!user) return false;
    if (PRIVILEGED_ROLES.includes(user.role || '')) return true;
    const aliases = PASTOR_MODULE_ALIASES[key] as readonly string[];
    return user.pastorModules?.some((m) => aliases.includes(m.moduleName || m.moduleKey || '')) ?? false;
}

/** Finds the stored assignment (canonical or legacy alias) for a module key. */
export function findPastorModuleAssignment<T extends { moduleKey?: string }>(assignments: T[], key: PastorModuleKey): T | undefined {
    const aliases = PASTOR_MODULE_ALIASES[key] as readonly string[];
    return assignments.find((m) => aliases.includes(m.moduleKey || ''));
}
