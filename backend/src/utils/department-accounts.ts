import { prisma } from './prisma.js';

const MIN_OPERATIONAL_BALANCE = 1500;

/** Ensures every department has an operational account (required for events/plans). */
export async function ensureDepartmentAccounts(minBalance = MIN_OPERATIONAL_BALANCE) {
    const departments = await prisma.department.findMany({ select: { id: true } });

    for (const dept of departments) {
        await prisma.account.upsert({
            where: { departmentId: dept.id },
            update: {},
            create: {
                departmentId: dept.id,
                balance: minBalance,
                totalIncome: minBalance,
                totalExpenditure: 0,
            },
        });
    }
}

export function isGlobalOperator(role: string) {
    return ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY'].includes(role);
}

export function resolveTargetDepartmentId(
    role: string,
    userDepartmentId: string | null | undefined,
    requestedDepartmentId?: string | null
) {
    if (isGlobalOperator(role)) {
        return requestedDepartmentId || userDepartmentId || null;
    }
    return userDepartmentId || null;
}
