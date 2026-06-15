import { prisma } from './prisma.js';
import { CANONICAL_PASTOR_MODULES } from './pastor-module-keys.js';

/**
 * Ensures all PASTOR and ASSOCIATE_PASTOR accounts have the baseline
 * operational modules assigned to them so their dashboards render correctly.
 */
export async function seedPastorModules() {
    console.log('🚀 Starting Pastor Modules Seed...');

    const baselineModules = CANONICAL_PASTOR_MODULES;

    const pastors = await prisma.user.findMany({
        where: {
            role: { in: ['PASTOR', 'ASSOCIATE_PASTOR'] }
        },
        include: {
            pastorModuleAccess: true
        }
    });

    console.log(`Found ${pastors.length} pastors. Auditing module assignments...`);

    let assignmentsMade = 0;

    for (const pastor of pastors) {
        const existingModules = pastor.pastorModuleAccess.map((m: any) => m.moduleKey);
        
        for (const moduleName of baselineModules) {
            if (!existingModules.includes(moduleName)) {
                await (prisma as any).pastorModuleAccess.create({
                    data: {
                        pastorId: pastor.id,
                        moduleKey: moduleName,
                        permissions: ['READ', 'WRITE', 'EXECUTE']
                    }
                });
                assignmentsMade++;
            }
        }
    }

    console.log(`✅ Pastor Modules Seed Complete. Assigned ${assignmentsMade} missing modules.`);
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.endsWith('seed-pastor-modules.ts')) {
    seedPastorModules()
        .catch(e => {
            console.error('❌ Pastor Module Seed Failed:', e);
            process.exit(1);
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}
