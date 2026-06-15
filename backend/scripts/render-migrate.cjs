/**
 * Render build helper: run migrate deploy with recovery for failed migrations (P3009/P3018).
 */
const { execSync } = require('child_process');

const PRISMA = 'npx prisma@5.22.0';
const FAILED_MIGRATION = '20260415180000_schema_sync_executive_portal';
const MAX_ATTEMPTS = 3;

function run(cmd) {
  execSync(cmd, { stdio: 'inherit', env: process.env });
}

function resolveRolledBack() {
  try {
    run(`${PRISMA} migrate resolve --rolled-back ${FAILED_MIGRATION}`);
  } catch {
    console.warn('[render-migrate] resolve --rolled-back skipped (may already be resolved)');
  }
}

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  try {
    console.log(`[render-migrate] migrate deploy attempt ${attempt}/${MAX_ATTEMPTS}`);
    run(`${PRISMA} migrate deploy`);
    process.exit(0);
  } catch (error) {
    console.warn(`[render-migrate] attempt ${attempt} failed`);
    if (attempt >= MAX_ATTEMPTS) {
      throw error;
    }
    resolveRolledBack();
  }
}
