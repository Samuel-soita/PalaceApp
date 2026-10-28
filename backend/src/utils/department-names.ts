export const DEFAULT_DEPARTMENTS = [
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
    'Treasury Department',
    'Deacons Department',
    'Intercessory & Prayer',
];

/**
 * Identity key for a department name: "Media & ICT", "media and ict" and
 * " Media  &  ICT " all map to the same key.
 */
export function departmentKey(name: string): string {
    return name
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '');
}

export function cleanDepartmentName(name: string): string {
    return name.trim().replace(/\s+/g, ' ');
}
