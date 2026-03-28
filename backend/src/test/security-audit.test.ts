import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:4000';

async function verifySecurityAndAudit() {
    console.log('🔐 STARTING SECURITY & AUDIT VALIDATION...');

    // Setup test personas
    const member = await prisma.user.findFirst({ where: { role: 'MEMBER' } });
    const leader = await prisma.user.findFirst({ where: { role: 'DEPARTMENT_LEADER' } });
    if (!member || !leader) throw new Error('Could not find MEMBER or LEADER in DB.');
    
    const memberLogin = await axios.post(`${BASE_URL}/auth/login`, { membershipNumber: member.membershipNumber });
    const leaderLogin = await axios.post(`${BASE_URL}/auth/login`, { membershipNumber: leader.membershipNumber });
    const memberToken = memberLogin.data.token;
    const leaderToken = leaderLogin.data.token;

    // 2. Attempt unauthorized access (RBAC test)
    console.log('🛡️ Testing RBAC: MEMBER attempt to view global financials...');
    try {
        await axios.get(`${BASE_URL}/finance/accounts/all`, { headers: { Authorization: `Bearer ${memberToken}` } });
        console.error('❌ SECURITY FAILURE: MEMBER accessed global financials!');
    } catch (err: any) {
        if (err.response?.status === 403) {
            console.log('✅ RBAC PASSED: Access Denied (403) for MEMBER.');
        } else {
            console.warn(`⚠️ UNEXPECTED RESPONSE: Status ${err.response?.status}`);
        }
    }

    // 3. Verify Audit Logging (Audit test)
    console.log('📜 Testing Audit Engine: Triggering state-changing operation...');
    // We'll try to request a withdrawal as the member (allowed for requester)
    const account = await prisma.account.findFirst();
    if (!account) throw new Error('No Account found.');

    try {
        await axios.post(`${BASE_URL}/finance/withdraw`, {
            accountId: account.id,
            amount: 100,
            description: 'Audit Test'
        }, { headers: { Authorization: `Bearer ${leaderToken}` } });

        // Wait for async audit log creation
        await new Promise(r => setTimeout(r, 500));

        // Check Audit Log
        const audit = await prisma.auditLog.findFirst({
            where: { actorId: leader.id, actionType: 'POST_FINANCE' },
            orderBy: { createdAt: 'desc' }
        });

        if (audit) {
            console.log('✅ AUDIT PASSED: State-changing operation was recorded in AuditLog.');
        } else {
             // Let's check common issue: maybe it's not POST_FINANCE but POST_WITHDRAW? 
             // Logic in middleware uses req.path.split('/')[1] -> 'finance'
            console.error('❌ AUDIT FAILURE: Operarion was NOT recorded.');
        }
    } catch (err: any) {
        console.error('❌ AUDIT TEST FAILED: Withdrawal request failed.', err.response?.data || err.message);
    }

    await prisma.$disconnect();
}

verifySecurityAndAudit().catch(console.error);
