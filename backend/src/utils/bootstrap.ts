import { prisma } from './prisma.js';
import { seedPermissions } from './seed-permissions.js';
import { ensureDepartmentAccounts } from './department-accounts.js';

/**
 * System Bootstrap: PRODUCTION-READY (Zero-Seed compatible)
 * Ensures essential infrastructure exists without relying on dummy data.
 */
export async function bootstrapSystem() {
    console.log('[System Kernel] Starting Mission Integrity Bootstrap...');

    // 1. Initialize Permissions & Roles (Idempotent)
    await seedPermissions();

    // 2. Initial Departments (Essential Infrastructure)
    const defaultDepts = [
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
        'Treasury  DEpartment ',
        'Deacons  Department ',
        'Intercessory & Prayer'
    ];
    const initialDepts = process.env.INITIAL_DEPARTMENTS?.split(',') || defaultDepts;
    for (const name of initialDepts) {
        const trimmed = name.trim();
        if (!trimmed) continue;
        
        console.log(`[Bootstrap] Preparing department: ${trimmed}`);
        try {
            await prisma.department.upsert({
                where: { name: trimmed },
                update: {},
                create: {
                    name: trimmed,
                    description: `Prayer Palace Apostolic Ministry — Strategic Hub for ${trimmed} operations.`
                }
            });
        } catch (err: any) {
            console.error(`[Bootstrap] FAILED department ${trimmed}:`, err.message);
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
