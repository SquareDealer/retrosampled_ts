// Runs before every e2e test file: the suite always talks to its own SQLite
// database, never to the dev one.
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? 'e2e-test-secret-e2e-test-secret-e2e';
process.env.JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? '900';
process.env.JWT_REFRESH_TTL = process.env.JWT_REFRESH_TTL ?? '2592000';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
