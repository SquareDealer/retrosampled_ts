import { validateEnv } from './env.validation';

const baseEnv = {
  DATABASE_URL: 'postgresql://retro:retro@localhost:5432/retrosamples',
  JWT_SECRET: 'a-sufficiently-long-secret',
};

describe('validateEnv', () => {
  it('accepts a valid configuration and applies defaults', () => {
    const result = validateEnv({ ...baseEnv });
    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(3000);
    expect(result.JWT_ACCESS_TTL).toBe(3600);
    expect(result.JWT_REFRESH_TTL).toBe(60 * 60 * 24 * 30);
    expect(result.APP_URL).toBe('http://localhost:5173');
  });

  it('throws when DATABASE_URL is missing', () => {
    const { DATABASE_URL, ...rest } = baseEnv;
    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL is required/);
  });

  it('throws when DATABASE_URL is not a postgres URL', () => {
    expect(() =>
      validateEnv({ ...baseEnv, DATABASE_URL: 'mysql://localhost/db' }),
    ).toThrow(/postgres/);
  });

  it('throws when JWT_SECRET is missing', () => {
    const { JWT_SECRET, ...rest } = baseEnv;
    expect(() => validateEnv(rest)).toThrow(/JWT_SECRET is required/);
  });

  it('throws when JWT_SECRET is too short', () => {
    expect(() => validateEnv({ ...baseEnv, JWT_SECRET: 'short' })).toThrow(
      /at least 16 characters/,
    );
  });

  it('rejects an invalid NODE_ENV', () => {
    expect(() => validateEnv({ ...baseEnv, NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV/,
    );
  });

  it('rejects an out-of-range PORT', () => {
    expect(() => validateEnv({ ...baseEnv, PORT: '70000' })).toThrow(/PORT/);
  });

  it('parses a custom PORT and TTLs', () => {
    const result = validateEnv({
      ...baseEnv,
      PORT: '4000',
      JWT_ACCESS_TTL: '900',
      JWT_REFRESH_TTL: '120',
    });
    expect(result.PORT).toBe(4000);
    expect(result.JWT_ACCESS_TTL).toBe(900);
    expect(result.JWT_REFRESH_TTL).toBe(120);
  });

  it('rejects a non-positive TTL', () => {
    expect(() =>
      validateEnv({ ...baseEnv, JWT_ACCESS_TTL: '0' }),
    ).toThrow(/JWT_ACCESS_TTL/);
  });
});
