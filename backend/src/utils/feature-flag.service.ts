import prisma from './prisma.js';
import { getOrSetCache, invalidateCache } from './redis.js';

export class FeatureFlagService {
    /**
     * Checks if a feature flag is enabled for the current context.
     * Caches results for 30 seconds for high performance.
     */
    static async isEnabled(name: string, context?: { role?: string, departmentId?: string }): Promise<boolean> {
        const flags = await getOrSetCache('system:feature_flags', async () => {
            return await prisma.featureFlag.findMany();
        }, 30);

        const flag = (flags as any[]).find(f => f.name === name);
        if (!flag || !flag.enabled) return false;

        if (flag.scope === 'GLOBAL') return true;

        // Role-based scoping: ROLE:PASTOR
        if (flag.scope.startsWith('ROLE:') && context?.role) {
            const requiredRole = flag.scope.split(':')[1];
            return context.role === requiredRole;
        }

        // Department-based scoping: DEPT:YOUTH
        if (flag.scope.startsWith('DEPT:') && context?.departmentId) {
            const requiredDeptName = flag.scope.split(':')[1];
            // We'd need to resolve dept name or use ID. For simplicity, let's assume we use ID in scope like DEPT_ID:uuid
            if (flag.scope.startsWith('DEPT_ID:')) {
                const requiredDeptId = flag.scope.split(':')[1];
                return context.departmentId === requiredDeptId;
            }
        }

        return false;
    }

    /**
     * Updates or creates a feature flag.
     */
    static async updateFlag(name: string, enabled: boolean, scope: string = 'GLOBAL') {
        const flag = await prisma.featureFlag.upsert({
            where: { name },
            update: { enabled, scope },
            create: { name, enabled, scope }
        });
        await invalidateCache('system:feature_flags');
        return flag;
    }
}
