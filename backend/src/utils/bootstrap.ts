import { prisma } from './prisma.js';
import { seedPermissions } from './seed-permissions.js';

/**
 * System Bootstrap: PRODUCTION-READY (Zero-Seed compatible)
 * Ensures essential infrastructure exists without relying on dummy data.
 */
export async function bootstrapSystem() {
    console.log('[System Kernel] Starting Mission Integrity Bootstrap...');

    // 1. Initialize Permissions & Roles (Idempotent)
    await seedPermissions();

    // 2. Initial Departments (Essential Infrastructure)
    const initialDepts = process.env.INITIAL_DEPARTMENTS?.split(',') || ['Pastoral', 'Ushering & Protocol', 'Media and ICT', 'Youth', 'Children'];
    for (const name of initialDepts) {
        const trimmed = name.trim();
        if (!trimmed) continue;
        
        await prisma.department.upsert({
            where: { name: trimmed },
            update: {},
            create: {
                name: trimmed,
                description: `Prayer Palace Apostolic Ministry — Strategic Hub for ${trimmed} operations.`
            }
        });
    }

    // 3. Root Watua user (Clearance Level 9: BISHOP_LEVEL)
    // Only created if no users exist in the system yet.
    const userCount = await prisma.user.count();
    const initId = process.env.INITIAL_WATUA_ID || '11111111';
    const initName = process.env.INITIAL_WATUA_NAME || 'Bishop Samuel';
    const initMember = process.env.INITIAL_WATUA_MEMBERSHIP || '001/001/2026';

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
