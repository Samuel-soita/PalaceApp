import prisma from './prisma.js';

async function seedUsers() {
    await prisma.user.create({
        data: {
            name: "Bishop Samuel",
            idNumber: "11111111",
            membershipNumber: "001/001/2026",
            phoneNumber: "0700000001",
            dob: new Date("1970-01-01"),
            gender: "MALE",
            role: "SUPER_ADMIN",
            status: "ACTIVE"
        }
    });

    await prisma.user.create({
        data: {
            name: "System Administrator",
            idNumber: "33333333",
            membershipNumber: "003/001/2026",
            phoneNumber: "0700000003",
            dob: new Date("1985-01-01"),
            gender: "MALE",
            role: "SYSTEM_ADMIN",
            status: "ACTIVE"
        }
    });

    await prisma.user.create({
        data: {
            name: "WATUA Engineer",
            idNumber: "99999999",
            membershipNumber: "999/999/2026",
            phoneNumber: "0799999999",
            dob: new Date("1990-01-01"),
            gender: "MALE",
            role: "WATUA",
            status: "ACTIVE"
        }
    });

    console.log("Admins created! Use membership numbers: 001/001/2026, 003/001/2026, 999/999/2026");
}

seedUsers()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
