// One-time setup for the e2e suite: apply migrations and seed the test database.
// Runs in its own process; the connection string is passed explicitly so it is
// independent of the developer's local .env.
const { execSync } = require('child_process');
const path = require('path');

module.exports = async () => {
  const DATABASE_URL =
    process.env.DATABASE_URL_TEST ||
    process.env.DATABASE_URL ||
    'postgresql://retro:retro@127.0.0.1:5432/retrosamples_test?schema=public';

  const cwd = path.join(__dirname, '..');
  const env = { ...process.env, DATABASE_URL };

  execSync('npx prisma migrate deploy', { cwd, env, stdio: 'inherit' });
  execSync('npx prisma db seed', { cwd, env, stdio: 'inherit' });
};
