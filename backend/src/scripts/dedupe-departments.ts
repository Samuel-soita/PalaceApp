import { prisma } from '../utils/prisma.js';

/**
 * 2.4.0 Kernel Tool: Deduplicate Departments
 * Corrects historic misspelled departments by migrating users/events and deleting the duplicate records.
 */
async function dedupeAndPrune() {
    console.log('[System Kernel] Initializing Department Deduplication Engine...');

    try {
        const allDepts = await prisma.department.findMany();
        
        // 1. Establish Canonical Maps
        const canonicalNames = ['Pastoral', 'Ushering & Protocol', 'Media and ICT', 'Youth', 'Children'];
        const mappedDepts: Record<string, any> = {};

        // 2. Identify & Map Existing Entities
        for (const dept of allDepts) {
            const nameLower = dept.name.toLowerCase();
            if (nameLower.includes('media') || nameLower.includes('ict')) {
                mappedDepts['Media and ICT'] = mappedDepts['Media and ICT'] || [];
                mappedDepts['Media and ICT'].push(dept);
            } else if (nameLower.includes('pastoral') || nameLower.includes('pastor')) {
                mappedDepts['Pastoral'] = mappedDepts['Pastoral'] || [];
                mappedDepts['Pastoral'].push(dept);
            } else if (nameLower.includes('usher') || nameLower.includes('protocol')) {
                mappedDepts['Ushering & Protocol'] = mappedDepts['Ushering & Protocol'] || [];
                mappedDepts['Ushering & Protocol'].push(dept);
            }
        }

        // 3. For every canonical cluster, select the FIRST as canonical, migrate rest -> First
        for (const [canonicalName, records] of Object.entries(mappedDepts)) {
            const arr = records as any[];
            if (arr.length <= 1) {
                // If there's 1, just rename it to be safe
                if (arr.length === 1 && arr[0].name !== canonicalName) {
                    await prisma.department.update({
                        where: { id: arr[0].id },
                        data: { name: canonicalName }
                    });
                    console.log(`[Dedupe] Standardized '${arr[0].name}' to Canonical: ${canonicalName}`);
                }
                continue;
            }

            console.log(`[Dedupe] Conflict Detected in ${canonicalName}. Merging ${arr.length} duplicates...`);
            
            // Sort to prioritize exact match, otherwise just grab the first
            arr.sort((a, b) => a.name === canonicalName ? -1 : 1);
            const primaryDept = arr[0];

            for (let i = 1; i < arr.length; i++) {
                const duplicateId = arr[i].id;
                console.log(`    -> Migrating data from '${arr[i].name}' (${duplicateId}) to Canonical...`);

                await prisma.$transaction(async (tx) => {
                    // Update Users
                    await tx.user.updateMany({ where: { departmentId: duplicateId }, data: { departmentId: primaryDept.id } });
                    // Update Projects
                    await tx.project.updateMany({ where: { departmentId: duplicateId }, data: { departmentId: primaryDept.id } });
                    // Update Events
                    await tx.event.updateMany({ where: { departmentId: duplicateId }, data: { departmentId: primaryDept.id } });
                    // Update Meetings
                    await tx.meeting.updateMany({ where: { departmentId: duplicateId }, data: { departmentId: primaryDept.id } });
                    // Update Plans, Announcements, Budgets, Children, Messages
                    await tx.plan.updateMany({ where: { departmentId: duplicateId }, data: { departmentId: primaryDept.id } });
                    await tx.announcement.updateMany({ where: { departmentId: duplicateId }, data: { departmentId: primaryDept.id } });
                    await tx.budget.updateMany({ where: { departmentId: duplicateId }, data: { departmentId: primaryDept.id } });
                    await tx.child.updateMany({ where: { departmentId: duplicateId }, data: { departmentId: primaryDept.id } });
                    await tx.message.updateMany({ where: { departmentId: duplicateId }, data: { departmentId: primaryDept.id } });
                    await tx.volunteer.updateMany({ where: { departmentId: duplicateId }, data: { departmentId: primaryDept.id } });
                    
                    // Update Financial Accounts
                    // We can't merge account balances perfectly, so we'll just link the current account to the new dept 
                    // Or ignore if the primary already has an account context.
                    const existingPrimaryAccount = await tx.account.findUnique({ where: { departmentId: primaryDept.id }});
                    if (!existingPrimaryAccount) {
                        await tx.account.updateMany({ where: { departmentId: duplicateId }, data: { departmentId: primaryDept.id } });
                    }
                    
                    // Final Destruction
                    await tx.department.delete({ where: { id: duplicateId } });
                });
            }
            
            // Rename primary to exact canonical case
            if (primaryDept.name !== canonicalName) {
                await prisma.department.update({ where: { id: primaryDept.id }, data: { name: canonicalName } });
            }
        }

        // 4. Eliminate Secretariat
        const secretariatDepts = allDepts.filter(d => d.name.toLowerCase().includes('secretariat'));
        for (const secDept of secretariatDepts) {
            console.log(`[Dedupe] Eradicating Secretariat Department: ID ${secDept.id}`);
            await prisma.$transaction(async (tx) => {
                await tx.user.updateMany({ where: { departmentId: secDept.id }, data: { departmentId: null } });
                await tx.project.deleteMany({ where: { departmentId: secDept.id } });
                await tx.event.deleteMany({ where: { departmentId: secDept.id } });
                await tx.meeting.deleteMany({ where: { departmentId: secDept.id } });
                
                // Eradicate other dependencies mapped to Secretariat
                await tx.plan.deleteMany({ where: { departmentId: secDept.id } });
                await tx.announcement.deleteMany({ where: { departmentId: secDept.id } });
                await tx.budget.deleteMany({ where: { departmentId: secDept.id } });
                await tx.child.deleteMany({ where: { departmentId: secDept.id } });
                await tx.message.deleteMany({ where: { departmentId: secDept.id } });
                await tx.volunteer.deleteMany({ where: { departmentId: secDept.id } });
                
                await tx.account.deleteMany({ where: { departmentId: secDept.id } });
                
                await tx.department.delete({ where: { id: secDept.id } });
            });
        }

        console.log('[System Kernel] Deduplication Engine Completed Successfully.');

    } catch (error) {
        console.error('[Dedupe ERROR]', error);
    } finally {
        await prisma.$disconnect();
    }
}

dedupeAndPrune();
