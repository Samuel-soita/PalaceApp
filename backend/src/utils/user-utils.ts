import prisma from './prisma.js';

/**
 * Generates the next membership number based on priority rules:
 * - Format: SEQ/BRANCH/YEAR (e.g., 001/001/2027)
 * - SEQ is 3 digits, starting from 001.
 * - Department Leaders get priority (lowest numbers).
 * - Members follows after leaders.
 */
export async function generateNextMembershipNumber(role: string, targetYear: number, branch: string = '001'): Promise<string> {
    const yearSuffix = `/${branch}/${targetYear}`;
    
    // Find all users who already have a number for the target year
    const existingUsers = await prisma.user.findMany({
        where: {
            membershipNumber: {
                endsWith: yearSuffix
            }
        },
        select: {
            membershipNumber: true,
            role: true
        }
    });

    // Parse existing sequences
    const existingSeqs = existingUsers.map(u => parseInt(u.membershipNumber.split('/')[0], 10));
    const maxSeq = existingSeqs.length > 0 ? Math.max(...existingSeqs) : 0;

    let nextSeq: number;

    if (['DEPARTMENT_LEADER', 'PASTOR', 'ASSOCIATE_PASTOR', 'SUPER_ADMIN', 'WATUA'].includes(role)) {
        const leaders = existingUsers.filter(u => ['DEPARTMENT_LEADER', 'PASTOR', 'ASSOCIATE_PASTOR', 'SUPER_ADMIN', 'WATUA'].includes(u.role));
        const leaderSeqs = leaders.map(u => parseInt(u.membershipNumber.split('/')[0], 10));
        const maxLeaderSeq = leaderSeqs.length > 0 ? Math.max(...leaderSeqs) : 0;
        
        nextSeq = maxLeaderSeq + 1;
        while (existingSeqs.includes(nextSeq)) {
            nextSeq++;
        }
    } else {
        const members = existingUsers.filter(u => !['DEPARTMENT_LEADER', 'PASTOR', 'ASSOCIATE_PASTOR', 'SUPER_ADMIN', 'WATUA'].includes(u.role));
        const memberSeqs = members.map(u => parseInt(u.membershipNumber.split('/')[0], 10));
        // Members start at 101
        const maxMemberSeq = memberSeqs.length > 0 ? Math.max(...memberSeqs) : 100;
        nextSeq = maxMemberSeq + 1;
        while (existingSeqs.includes(nextSeq)) {
            nextSeq++;
        }
    }

    // Format to 3 digits
    const seqStr = String(nextSeq).padStart(3, '0');
    return `${seqStr}${yearSuffix}`;
}

/**
 * Checks if a user is eligible for renewal (3 weeks before expiry).
 */
export function isEligibleForRenewal(expiry: Date | null): { eligible: boolean; daysRemaining: number } {
    if (!expiry) return { eligible: true, daysRemaining: 0 };
    
    const now = new Date();
    const expiryDate = new Date(expiry);
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Eligible if expires in 21 days or less
    return {
        eligible: diffDays <= 21,
        daysRemaining: diffDays
    };
}
