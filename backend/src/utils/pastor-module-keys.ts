/** Canonical pastor module keys and legacy aliases stored in the database. */
export const PASTOR_MODULE_ALIASES: Record<string, string[]> = {
    EventOversight: ['EventOversight', 'Event Oversight'],
    PartnershipManagement: ['PartnershipManagement', 'Partnership Management'],
    ChildDedication: ['ChildDedication', 'Child Dedication Registry'],
    DevotionPublishing: ['DevotionPublishing'],
    ProjectOversight: ['ProjectOversight', 'Project Oversight'],
};

export const CANONICAL_PASTOR_MODULES = Object.keys(PASTOR_MODULE_ALIASES);

export function pastorHasModule(assignedModules: string[] | undefined, requiredKey: string): boolean {
    if (!assignedModules?.length) return false;
    const aliases = PASTOR_MODULE_ALIASES[requiredKey] || [requiredKey];
    return assignedModules.some((m) => aliases.includes(m));
}
