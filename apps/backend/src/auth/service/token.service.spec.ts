import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';

const makeConfig = (overrides: Record<string, unknown> = {}) => {
  const values: Record<string, unknown> = {
    JWT_SECRET: 'test-secret-at-least-16-chars',
    JWT_ACCESS_TTL: 3600,
    JWT_REFRESH_TTL: 2592000,
    ...overrides,
  };
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
};

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(() => {
    service = new TokenService(makeConfig());
  });

  describe('access tokens', () => {
    it('signs and verifies a valid token', () => {
      const { token, expiresIn } = service.signAccessToken({
        id: 'user-1',
        email: 'a@b.dev',
      });
      expect(expiresIn).toBe(3600);

      const payload = service.verifyAccessToken(token);
      expect(payload).toMatchObject({ sub: 'user-1', email: 'a@b.dev' });
    });

    it('rejects a token with a tampered payload', () => {
      const { token } = service.signAccessToken({ id: 'user-1', email: 'a@b.dev' });
      const [header, , signature] = token.split('.');
      const forgedPayload = Buffer.from(
        JSON.stringify({ sub: 'admin', email: 'x', exp: 9999999999 }),
      ).toString('base64url');
      const forged = `${header}.${forgedPayload}.${signature}`;
      expect(service.verifyAccessToken(forged)).toBeNull();
    });

    it('rejects a token signed with a different secret', () => {
      const other = new TokenService(makeConfig({ JWT_SECRET: 'a-totally-different-secret' }));
      const { token } = other.signAccessToken({ id: 'user-1', email: 'a@b.dev' });
      expect(service.verifyAccessToken(token)).toBeNull();
    });

    it('rejects an expired token', () => {
      const shortLived = new TokenService(makeConfig({ JWT_ACCESS_TTL: -10 }));
      const { token } = shortLived.signAccessToken({ id: 'user-1', email: 'a@b.dev' });
      expect(shortLived.verifyAccessToken(token)).toBeNull();
    });

    it('rejects a malformed token', () => {
      expect(service.verifyAccessToken('not-a-jwt')).toBeNull();
      expect(service.verifyAccessToken('a.b')).toBeNull();
    });
  });

  describe('refresh tokens', () => {
    it('creates an opaque token with a hashed counterpart and future expiry', () => {
      const { raw, hash, expiresAt } = service.createRefreshToken();
      expect(raw).toHaveLength(64); // 48 bytes base64url
      expect(hash).toBe(service.hash(raw));
      expect(hash).not.toBe(raw);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('produces deterministic hashes', () => {
      expect(service.hash('value')).toBe(service.hash('value'));
      expect(service.hash('value')).not.toBe(service.hash('other'));
    });
  });
});
