import { prisma } from './prisma.js';
import { PERMISSIONS } from './permissions.js';

async function seedPermissions() {
    console.log('🚀 Starting Permission Engine Seed...');

    // 1. Seed Permissions
    const permissionEntries = Object.values(PERMISSIONS);
    for (const code of permissionEntries) {
        await prisma.permission.upsert({
            where: { code },
            update: {},
            create: { code, description: `Capability to ${code.toLowerCase().replace(/_/g, ' ')}` }
        });
    }
    console.log(`✅ Seeded ${permissionEntries.length} permissions.`);

    // 2. Seed Roles
    const roles = [
        'SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'PASTOR', 'ASSOCIATE_PASTOR',
        'DEPARTMENT_LEADER', 'MANAGER', 'USHERING_LEADER', 'MEMBER', 'WATUA'
    ];

    for (const name of roles) {
        await prisma.role.upsert({
            where: { name },
            update: {},
            create: { name, description: `The ${name} role` }
        });
    }
    console.log(`✅ Seeded ${roles.length} roles.`);

    // 3. Map Default Permissions
    const allPermissions = await prisma.permission.findMany();
    const allPermIds = allPermissions.map(p => p.id);

    const roleMap: Record<string, string[]> = {
        'WATUA': permissionEntries, // Everything
        'SUPER_ADMIN': [
            PERMISSIONS.VIEW_GLOBAL_STATS, PERMISSIONS.VIEW_FINANCIALS, 
            PERMISSIONS.MANAGE_DEPARTMENTS, PERMISSIONS.VIEW_PERSONNEL,
            PERMISSIONS.MANAGE_USERS, PERMISSIONS.APPROVE_BAPTISM, 
            PERMISSIONS.APPROVE_DEDICATION, PERMISSIONS.VIEW_PASTORAL_PORTAL,
            PERMISSIONS.ACCESS_WATUA, PERMISSIONS.MANAGE_PERMISSIONS, PERMISSIONS.VIEW_SYSTEM_LOGS
        ],
        'SYSTEM_ADMIN': [
            PERMISSIONS.VIEW_GLOBAL_STATS, PERMISSIONS.VIEW_FINANCIALS, 
            PERMISSIONS.MANAGE_DEPARTMENTS, PERMISSIONS.VIEW_PERSONNEL,
            PERMISSIONS.MANAGE_USERS, PERMISSIONS.APPROVE_BAPTISM, 
            PERMISSIONS.APPROVE_DEDICATION, PERMISSIONS.VIEW_PASTORAL_PORTAL
        ],
        'SECRETARY': [
            PERMISSIONS.VIEW_GLOBAL_STATS, PERMISSIONS.VIEW_PERSONNEL,
            PERMISSIONS.MANAGE_USERS, PERMISSIONS.APPROVE_BAPTISM, 
            PERMISSIONS.APPROVE_DEDICATION, PERMISSIONS.VIEW_PASTORAL_PORTAL
        ],
        'PASTOR': [
            PERMISSIONS.VIEW_PASTORAL_PORTAL, PERMISSIONS.APPROVE_BAPTISM, 
            PERMISSIONS.APPROVE_DEDICATION, PERMISSIONS.MANAGE_APPOINTMENTS
        ],
        'ACCOUNTANT': [
            PERMISSIONS.VIEW_FINANCIALS, PERMISSIONS.VIEW_GLOBAL_STATS
        ],
        'DEPARTMENT_LEADER': [
            PERMISSIONS.VIEW_DEPARTMENT, PERMISSIONS.MANAGE_DEPARTMENT_PROJECTS,
            PERMISSIONS.MANAGE_DEPARTMENT_EVENTS, PERMISSIONS.MANAGE_DEPARTMENT_PLANS,
            PERMISSIONS.CREATE_ANNOUNCEMENTS_LOCAL
        ],
        'MEMBER': [] // Base member has no special permissions yet
    };

    for (const [roleName, permCodes] of Object.entries(roleMap)) {
        const role = await prisma.role.findUnique({ where: { name: roleName } });
        if (!role) continue;

        const perms = allPermissions.filter(p => permCodes.includes(p.code as any));
        
        await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
        await prisma.rolePermission.createMany({
            data: perms.map(p => ({
                roleId: role.id,
                permissionId: p.id
            }))
        });
    }

    console.log('🏁 Permission Engine Seed Complete!');
}

seedPermissions()
    .catch(e => {
        console.error('❌ Seed Failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
