import { prisma, rawPrisma } from './prisma.js';
import { seedPermissions } from './seed-permissions.js';
import { ensureDepartmentAccounts } from './department-accounts.js';
import { DEFAULT_DEPARTMENTS, cleanDepartmentName, departmentKey } from './department-names.js';

/**
 * System Bootstrap: PRODUCTION-READY (Zero-Seed compatible)
 * Ensures essential infrastructure exists without relying on dummy data.
 */
export async function bootstrapSystem() {
    console.log('[System Kernel] Starting Mission Integrity Bootstrap...');

    // 1. Initialize Permissions & Roles (Idempotent)
    await seedPermissions();

    // 2. Initial Departments (Essential Infrastructure)
    // Matched by departmentKey (case/spacing/"&" insensitive) and including soft-deleted
    // rows, so renamed or merged departments are never recreated as duplicates.
    const initialDepts = process.env.INITIAL_DEPARTMENTS?.split(',') || DEFAULT_DEPARTMENTS;
    const existing = await rawPrisma.department.findMany({ select: { name: true } });
    const existingKeys = new Set(existing.map(d => departmentKey(d.name)));

    for (const raw of initialDepts) {
        const name = cleanDepartmentName(raw);
        if (!name) continue;
        const key = departmentKey(name);
        if (existingKeys.has(key)) continue;

        console.log(`[Bootstrap] Creating missing department: ${name}`);
        try {
            await prisma.department.create({
                data: {
                    name,
                    description: `Prayer Palace Apostolic Ministry — Strategic Hub for ${name} operations.`
                }
            });
            existingKeys.add(key);
        } catch (err: any) {
            console.error(`[Bootstrap] FAILED department ${name}:`, err.message);
            throw err; // Fail fast if essential infra cannot be created
        }
    }
    console.log('[Bootstrap] Essential Departments verified/created.');

    // 2b. Operational accounts (events/plans require >= 1500 KES reserve)
    await ensureDepartmentAccounts();
    console.log('[Bootstrap] Department operational accounts verified.');

    // 3. Root Watua user (Clearance Level 9: BISHOP_LEVEL)
    // Only created if no users exist in the system yet.
    console.log('[Bootstrap] Verification step: Checking user count...');
    const userCount = await prisma.user.count();
    console.log(`[Bootstrap] Current user count: ${userCount}`);
    const initId = process.env.INITIAL_WATUA_ID || 'watua';
    const initName = process.env.INITIAL_WATUA_NAME || 'watua';
    const initMember = process.env.INITIAL_WATUA_MEMBERSHIP || 'watua';

    if (userCount === 0) {
        console.log(`[System Kernel] Establishing FIRST_WATUA_ROOT clearance for: ${initName}`);
        await prisma.user.create({
            data: {
                name: initName,
                idNumber: initId,
                membershipNumber: initMember,
                dob: new Date('1990-01-01'),
                gender: 'MALE',
                role: 'WATUA',
                status: 'ACTIVE',
                isCardPaid: true
            }
        });
        console.log(`✅ ROOT_WATUA_BOOTSTRAP_COMPLETE. Login with Membership: ${initMember}`);
    }

    console.log('[System Kernel] Mission Integrity Bootstrap Successful.');
}
