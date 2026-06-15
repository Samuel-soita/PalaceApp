/**
 * Render build helper: run migrate deploy, and if a prior migration failed (P3009),
 * mark it rolled back once and retry so production can recover safely.
 */
const { execSync } = require('child_process');

const PRISMA = 'npx prisma@5.22.0';
const FAILED_MIGRATION = '20260415180000_schema_sync_executive_portal';

function run(cmd) {
  execSync(cmd, { stdio: 'inherit', env: process.env });
}

try {
  run(`${PRISMA} migrate deploy`);
} catch (firstError) {
  console.warn('[render-migrate] migrate deploy failed — attempting recovery for', FAILED_MIGRATION);
  try {
    run(`${PRISMA} migrate resolve --rolled-back ${FAILED_MIGRATION}`);
  } catch {
    console.warn('[render-migrate] resolve --rolled-back skipped (may already be resolved)');
  }
  run(`${PRISMA} migrate deploy`);
}
