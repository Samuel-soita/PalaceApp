import 'dotenv/config';
import { rawPrisma as db } from '../utils/prisma.js';
import { DEFAULT_DEPARTMENTS, cleanDepartmentName, departmentKey } from '../utils/department-names.js';

/**
 * Merge duplicate departments ("Media & ICT" vs "Media and ICT", "Treasury  DEpartment " vs
 * "Treasury  DEpartment", ...) into a single canonical record.
 *
 *   npm run departments:merge            -> dry run, prints the plan only
 *   npm run departments:merge -- --apply -> performs the merge
 *
 * Duplicates are soft-deleted (deletedReason = MERGED_INTO:<id>) after every reference has been
 * moved, so nothing is destroyed. Account balances of duplicates are added to the canonical account.
 */

const APPLY = process.argv.includes('--apply');

const DEPT_FK_MODELS = [
    'user', 'child', 'event', 'meeting', 'announcement', 'project',
    'plan', 'message', 'budget', 'departmentReport', 'technicalRepair',
] as const;

const defaultByKey = new Map(DEFAULT_DEPARTMENTS.map(n => [departmentKey(n), n]));

type Dept = Awaited<ReturnType<typeof db.department.findMany>>[number];

async function referenceCounts(id: string) {
    const counts: Record<string, number> = {};
    for (const model of DEPT_FK_MODELS) {
        counts[model] = await (db as any)[model].count({ where: { departmentId: id } });
    }
    const [managers] = await db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "_DeptManagers" WHERE "A" = ${id}`;
    const [tagged] = await db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "Message" WHERE ${id} = ANY("taggedDepartmentIds")`;
    counts.managers = Number(managers.n);
    counts.taggedMessages = Number(tagged.n);
    return counts;
}

const total = (c: Record<string, number>) => Object.values(c).reduce((a, b) => a + b, 0);

function pickCanonical(group: { dept: Dept; refs: number }[]) {
    const defaultName = defaultByKey.get(departmentKey(group[0].dept.name));
    return [...group].sort((a, b) => {
        const aDeleted = a.dept.deletedAt ? 1 : 0;
        const bDeleted = b.dept.deletedAt ? 1 : 0;
        if (aDeleted !== bDeleted) return aDeleted - bDeleted;
        const aExact = a.dept.name === defaultName ? 0 : 1;
        const bExact = b.dept.name === defaultName ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        if (a.refs !== b.refs) return b.refs - a.refs;
        return a.dept.createdAt.getTime() - b.dept.createdAt.getTime();
    })[0];
}

async function mergeInto(keep: Dept, dup: Dept) {
    await db.$transaction(async (tx) => {
        for (const model of DEPT_FK_MODELS) {
            await (tx as any)[model].updateMany({ where: { departmentId: dup.id }, data: { departmentId: keep.id } });
        }

        await tx.$executeRaw`
            INSERT INTO "_DeptManagers" ("A", "B")
            SELECT ${keep.id}, "B" FROM "_DeptManagers" WHERE "A" = ${dup.id}
            ON CONFLICT DO NOTHING`;
        await tx.$executeRaw`DELETE FROM "_DeptManagers" WHERE "A" = ${dup.id}`;

        await tx.$executeRaw`
            UPDATE "Message"
            SET "taggedDepartmentIds" = ARRAY(
                SELECT DISTINCT unnest(array_replace("taggedDepartmentIds", ${dup.id}, ${keep.id}))
            )
            WHERE ${dup.id} = ANY("taggedDepartmentIds")`;

        const dupAccount = await tx.account.findUnique({ where: { departmentId: dup.id } });
        if (dupAccount) {
            const keepAccount = await tx.account.findUnique({ where: { departmentId: keep.id } });
            if (!keepAccount) {
                await tx.account.update({ where: { id: dupAccount.id }, data: { departmentId: keep.id } });
            } else {
                await tx.transaction.updateMany({ where: { accountId: dupAccount.id }, data: { accountId: keepAccount.id } });
                await tx.account.update({
                    where: { id: keepAccount.id },
                    data: {
                        balance: { increment: dupAccount.balance },
                        totalIncome: { increment: dupAccount.totalIncome },
                        totalExpenditure: { increment: dupAccount.totalExpenditure },
                        version: { increment: 1 },
                    },
                });
                await tx.account.update({
                    where: { id: dupAccount.id },
                    data: { balance: 0, totalIncome: 0, totalExpenditure: 0, deletedAt: new Date(), version: { increment: 1 } },
                });
            }
        }

        if (!keep.leaderId && dup.leaderId) {
            await tx.department.update({ where: { id: keep.id }, data: { leaderId: dup.leaderId } });
        }

        await tx.department.update({
            where: { id: dup.id },
            data: {
                name: `${dup.name.trim()} [merged ${dup.id.slice(0, 8)}]`,
                deletedAt: dup.deletedAt ?? new Date(),
                deletedReason: `MERGED_INTO:${keep.id}`,
                version: { increment: 1 },
            },
        });
    }, { timeout: 120000, maxWait: 20000 });
}

async function main() {
    console.log(APPLY ? '=== APPLY MODE: changes will be written ===' : '=== DRY RUN (pass --apply to merge) ===');

    const all = await db.department.findMany({ orderBy: { createdAt: 'asc' } });
    const live = all.filter(d => !(d.deletedReason ?? '').startsWith('MERGED_INTO:'));

    const groups = new Map<string, Dept[]>();
    for (const d of live) {
        const key = departmentKey(d.name);
        groups.set(key, [...(groups.get(key) ?? []), d]);
    }

    let mergedGroups = 0;
    const renames: { dept: Dept; to: string }[] = [];

    for (const [key, depts] of groups) {
        const targetName = defaultByKey.get(key) ?? cleanDepartmentName(depts[0].name);

        if (depts.length === 1) {
            if (depts[0].name !== targetName && !depts[0].deletedAt) renames.push({ dept: depts[0], to: targetName });
            continue;
        }

        mergedGroups++;
        const scored = [];
        for (const dept of depts) {
            const counts = await referenceCounts(dept.id);
            const account = await db.account.findUnique({ where: { departmentId: dept.id } });
            scored.push({ dept, counts, refs: total(counts), account });
        }
        const keep = pickCanonical(scored);

        console.log(`\nDuplicate group "${targetName}" (${depts.length} records)`);
        for (const s of scored) {
            const tag = s === keep ? 'KEEP ' : 'MERGE';
            const nonZero = Object.entries(s.counts).filter(([, n]) => n > 0).map(([k, n]) => `${k}=${n}`).join(', ') || 'no references';
            const acct = s.account ? ` | account balance=${s.account.balance}` : '';
            const del = s.dept.deletedAt ? ' (soft-deleted)' : '';
            console.log(`  ${tag} ${JSON.stringify(s.dept.name)} ${s.dept.id}${del}: ${nonZero}${acct}`);
        }
        if (keep.dept.name !== targetName) console.log(`  -> canonical record will be renamed to ${JSON.stringify(targetName)}`);

        if (APPLY) {
            for (const s of scored) {
                if (s !== keep) await mergeInto(keep.dept, s.dept);
            }
            if (keep.dept.name !== targetName) {
                await db.department.update({ where: { id: keep.dept.id }, data: { name: targetName, version: { increment: 1 } } });
            }
            console.log('  merged.');
        }
    }

    for (const r of renames) {
        console.log(`\nRename ${JSON.stringify(r.dept.name)} -> ${JSON.stringify(r.to)}`);
        if (APPLY) await db.department.update({ where: { id: r.dept.id }, data: { name: r.to, version: { increment: 1 } } });
    }

    console.log(`\n${mergedGroups} duplicate group(s), ${renames.length} rename(s). ${APPLY ? 'Done.' : 'Nothing was changed.'}`);
    if (APPLY && mergedGroups > 0) console.log('Department lists are cached for up to 5 minutes; restart the API to see changes immediately.');
}

main()
    .catch((err) => {
        console.error('[departments:merge] FAILED:', err);
        process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
