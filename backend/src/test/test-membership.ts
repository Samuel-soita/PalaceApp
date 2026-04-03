import prisma from '../utils/prisma.js';
import { generateNextMembershipNumber, isEligibleForRenewal } from '../utils/user-utils.js';

async function runTests() {
    console.log("=== Testing isEligibleForRenewal ===");
    
    const now = new Date();
    
    // Expired exactly now
    console.log("Expired today:", isEligibleForRenewal(now));
    
    // Expires in 10 days
    const in10Days = new Date();
    in10Days.setDate(now.getDate() + 10);
    console.log("Expires in 10 days:", isEligibleForRenewal(in10Days));
    
    // Expires in 21 days
    const in21Days = new Date();
    in21Days.setDate(now.getDate() + 21);
    console.log("Expires in 21 days:", isEligibleForRenewal(in21Days));
    
    // Expires in 22 days
    const in22Days = new Date();
    in22Days.setDate(now.getDate() + 22);
    console.log("Expires in 22 days:", isEligibleForRenewal(in22Days));

    console.log("\n=== Testing generateNextMembershipNumber ===");
    const targetYear = 2026;
    
    // Clear existing for a clean test using transactions or just mock it? We can't mock prisma easily in a script
    // Let's just run it against the local dev DB
    
    const nextMember = await generateNextMembershipNumber('MEMBER', targetYear);
    console.log(`Next Member Number (${targetYear}): ${nextMember}`);
    
    const nextLeader = await generateNextMembershipNumber('DEPARTMENT_LEADER', targetYear);
    console.log(`Next Leader Number (${targetYear}): ${nextLeader}`);

    process.exit(0);
}

runTests().catch(console.error);
