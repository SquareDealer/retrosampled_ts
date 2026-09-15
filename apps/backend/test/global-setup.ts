import { execFileSync } from 'child_process';
import { rmSync } from 'fs';
import { join } from 'path';

const BACKEND_ROOT = join(__dirname, '..');
const TEST_DATABASE_URL = 'file:./test.db';

/**
 * Recreates `prisma/test.db` from the committed migrations before the e2e run.
 * Relative SQLite URLs resolve against the schema directory, so the file lands
 * in `apps/backend/prisma/` (gitignored).
 */
export default async function globalSetup(): Promise<void> {
  process.env.DATABASE_URL = TEST_DATABASE_URL;

  for (const suffix of ['', '-journal']) {
    rmSync(join(BACKEND_ROOT, 'prisma', `test.db${suffix}`), { force: true });
  }

  execFileSync(
    join(BACKEND_ROOT, 'node_modules', '.bin', 'prisma'),
    ['migrate', 'deploy'],
    {
      cwd: BACKEND_ROOT,
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: 'inherit',
    },
  );
}
