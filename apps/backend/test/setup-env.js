// Runs in every Jest worker before the test modules are imported, so the
// application picks up the test database and a deterministic auth secret.
// @nestjs/config + dotenv never override variables already set here.
const DEFAULT_TEST_DB =
  'postgresql://retro:retro@127.0.0.1:5432/retrosamples_test?schema=public';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST || process.env.DATABASE_URL || DEFAULT_TEST_DB;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-at-least-16-chars';
process.env.JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL || '3600';
process.env.JWT_REFRESH_TTL = process.env.JWT_REFRESH_TTL || '2592000';
process.env.APP_URL = process.env.APP_URL || 'http://localhost:5173';
