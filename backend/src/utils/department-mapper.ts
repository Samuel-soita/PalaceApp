import prisma from './prisma.js';

/**
 * DOB Department Mapping Logic (KISS principle).
 * - Age < 13  → Rising star generation (Sunday School)
 * - Age 13-19 → 3 SixTeen Generation (Teenagers)
 * - Age 20-32 → Royal Tribe of Light (Youths)
 * - Age > 32  → Men's or Women's (based on gender)
 */
export function getDepartmentNameByDob(dob: Date, gender: string): string {
    const ageMs = Date.now() - new Date(dob).getTime();
    const age = Math.floor(ageMs / (1000 * 60 * 60 * 24 * 365.25));

    if (age < 13) return 'Rising star generation';
    if (age < 20) return '3 SixTeen Generation';
    if (age <= 32) return 'Royal Tribe of Light';
    return gender?.toUpperCase() === 'FEMALE' ? 'Esther Arise' : 'PPAM ABRAHAM GENERATION';
}

/**
 * Finds the department ID based on DOB and gender.
 */
export async function findTargetDepartmentId(dob: Date, gender: string): Promise<string | null> {
    const targetDeptName = getDepartmentNameByDob(dob, gender);
    const department = await prisma.department.findFirst({
        where: { name: { contains: targetDeptName } }
    });
    return department?.id || null;
}
