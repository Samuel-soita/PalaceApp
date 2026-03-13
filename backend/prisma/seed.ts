import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const departments = [
    'Praise & Worship',
    'Deacons',
    'Women',
    'Sunday School',
    'Men',
    'Youth',
    'Choir',
    'Media',
    'Hospitality',
    'Pastoral'
];

async function main() {
    console.log('🚀 Starting seed...');

    const hashedPassword = await bcrypt.hash('password123', 10);
    const superAdmin = await prisma.user.upsert({
        where: { email: 'admin@palacehub.com' },
        update: {},
        create: {
            email: 'admin@palacehub.com',
            password: hashedPassword,
            name: 'Global Commander',
            role: 'SUPER_ADMIN'
        }
    });

    console.log(`👤 Super Admin Ready: ${superAdmin.name}`);

    for (const name of departments) {
        const dept = await prisma.department.upsert({
            where: { name },
            update: {},
            create: {
                name,
                description: `Official command sector for ${name} operations.`,
            },
        });

        console.log(`✅ Sector Synced: ${dept.name}`);

        console.log(`✅ Sector Synced: ${dept.name}`);

        // Create a department leader for each sector
        const slug = name.toLowerCase().replace(/ & /g, '.').replace(/ /g, '.');
        const email = `${slug}@palacehub.com`;

        await prisma.user.upsert({
            where: { email },
            update: { departmentId: dept.id },
            create: {
                email,
                password: hashedPassword,
                name: `Commander ${name}`,
                role: 'DEPARTMENT_LEADER',
                departmentId: dept.id
            }
        });
        console.log(`👤 Leader Synced: ${email}`);

        // Seed a sample budget for each
        await prisma.budget.create({
            data: {
                title: `${name} Annual Q1 Budget`,
                targetAmount: 5000 + Math.random() * 5000,
                amountRaised: 1000 + Math.random() * 2000,
                deadline: new Date('2026-06-30'),
                departmentId: dept.id,
                status: 'OPEN'
            }
        });

        // Seed a sample meeting for each
        await prisma.meeting.create({
            data: {
                title: `${name} Monthly Strategic Review`,
                date: new Date('2026-03-15'),
                time: '18:00',
                venue: 'Sector Alpha Hall',
                meetingType: 'REVIEW',
                agenda: 'Reviewing operational readiness and tactical objectives.',
                organizerId: superAdmin.id,
                departmentId: dept.id,
                meetingStatus: 'SCHEDULED'
            }
        });
    }

    console.log('🏁 Seed complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
