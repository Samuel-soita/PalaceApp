import { RecoveryService } from './src/utils/recovery.service';
import prisma from './src/utils/prisma';

async function test() {
    try {
        console.log("Starting test...");
        const trash = await RecoveryService.getTrashBin();
        console.log("Trash result:", JSON.stringify(trash, null, 2));
    } catch (err: any) {
        console.error("CRITICAL ERROR:", err.message);
        console.error(err.stack);
    } finally {
        await prisma.$disconnect();
    }
}

test();
