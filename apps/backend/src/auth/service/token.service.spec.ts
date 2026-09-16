import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { decodeJwt } from 'jose';
import { PrismaService } from '../../prisma/prisma.service';
import { JWT_AUDIENCE, JWT_ISSUER, TokenService } from './token.service';

type StoredToken = {
  id: string;
  tokenHash: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
};

const ENV: Record<string, string | number> = {
  JWT_SECRET: 'test-secret-that-is-long-enough',
  JWT_ACCESS_TTL: 900,
  JWT_REFRESH_TTL: 2592000,
};

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Tiny in-memory stand-in for `prisma.refreshToken`. */
function createPrismaMock() {
  const rows: StoredToken[] = [];
  let nextId = 1;

  return {
    rows,
    refreshToken: {
      create: jest.fn(async ({ data }: { data: Omit<StoredToken, 'id' | 'revokedAt' | 'replacedById'> }) => {
        const row: StoredToken = {
          id: `token-${nextId++}`,
          revokedAt: null,
          replacedById: null,
          ...data,
        };
        rows.push(row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: { where: { tokenHash: string } }) => {
        return rows.find((row) => row.tokenHash === where.tokenHash) ?? null;
      }),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<StoredToken>;
        }) => {
          const row = rows.find((item) => item.id === where.id);
          if (!row) {
            throw new Error('not found');
          }
          Object.assign(row, data);
          return row;
        },
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { familyId?: string; userId?: string; revokedAt: null; NOT?: { familyId: string } };
          data: Partial<StoredToken>;
        }) => {
          const matched = rows.filter(
            (row) =>
              row.revokedAt === null &&
              (where.familyId === undefined || row.familyId === where.familyId) &&
              (where.userId === undefined || row.userId === where.userId) &&
              (where.NOT === undefined || row.familyId !== where.NOT.familyId),
          );
          matched.forEach((row) => Object.assign(row, data));
          return { count: matched.length };
        },
      ),
    },
  };
}

describe('TokenService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: TokenService;

  beforeEach(() => {
    prisma = createPrismaMock();
    const configService = {
      get: (key: string) => ENV[key],
    } as unknown as ConfigService;

    service = new TokenService(prisma as unknown as PrismaService, configService);
  });

  describe('access tokens', () => {
    it('signs an HS256 token with the agreed issuer, audience and claims', async () => {
      const token = await service.signAccessToken({
        id: 'user-1',
        email: 'a@example.com',
        username: 'southkid',
        role: 'USER',
      });

      const payload = decodeJwt(token);
      expect(payload.iss).toBe(JWT_ISSUER);
      expect(payload.aud).toBe(JWT_AUDIENCE);
      expect(payload.sub).toBe('user-1');
      expect(payload.email).toBe('a@example.com');
      expect(payload.username).toBe('southkid');
      expect(payload.role).toBe('USER');
      expect(payload.exp! - payload.iat!).toBe(900);
    });

    it('verifies its own token back into a request user', async () => {
      const token = await service.signAccessToken({
        id: 'user-1',
        email: 'a@example.com',
        username: 'southkid',
        role: 'ADMIN',
      });

      await expect(service.verifyAccessToken(token)).resolves.toEqual({
        sub: 'user-1',
        id: 'user-1',
        email: 'a@example.com',
        username: 'southkid',
        role: 'ADMIN',
      });
    });

    it('rejects a tampered token', async () => {
      const token = await service.signAccessToken({
        id: 'user-1',
        email: 'a@example.com',
        username: 'southkid',
        role: 'USER',
      });

      await expect(
        service.verifyAccessToken(`${token.slice(0, -2)}xy`),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh tokens', () => {
    it('stores only the sha256 of the opaque token', async () => {
      const issued = await service.issueRefreshToken('user-1');

      expect(prisma.rows).toHaveLength(1);
      expect(prisma.rows[0].tokenHash).toBe(sha256(issued.token));
      expect(prisma.rows[0].tokenHash).not.toContain(issued.token);
      expect(Buffer.from(issued.token, 'base64url')).toHaveLength(32);
    });

    it('rotates within the same family and revokes the old row', async () => {
      const first = await service.issueRefreshToken('user-1');
      const { userId, refresh } = await service.rotateRefreshToken(first.token);

      expect(userId).toBe('user-1');
      expect(refresh.familyId).toBe(first.familyId);
      expect(refresh.token).not.toBe(first.token);

      const old = prisma.rows.find((row) => row.tokenHash === sha256(first.token));
      expect(old?.revokedAt).toBeInstanceOf(Date);
      expect(old?.replacedById).toBe(refresh.id);
    });

    it('revokes the whole family when a rotated token is replayed', async () => {
      const first = await service.issueRefreshToken('user-1');
      const { refresh: second } = await service.rotateRefreshToken(first.token);

      await expect(service.rotateRefreshToken(first.token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      const live = prisma.rows.find((row) => row.tokenHash === sha256(second.token));
      expect(live?.revokedAt).toBeInstanceOf(Date);

      await expect(service.rotateRefreshToken(second.token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an expired token and kills its family', async () => {
      const issued = await service.issueRefreshToken('user-1');
      prisma.rows[0].expiresAt = new Date(Date.now() - 1000);

      await expect(service.rotateRefreshToken(issued.token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.rows[0].revokedAt).toBeInstanceOf(Date);
    });

    it('rejects an unknown token', async () => {
      await expect(service.rotateRefreshToken('nope')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('revokes every session but the caller‘s when asked', async () => {
      const keep = await service.issueRefreshToken('user-1');
      const other = await service.issueRefreshToken('user-1');

      await service.revokeAllForUser('user-1', { exceptFamilyId: keep.familyId });

      const kept = prisma.rows.find((row) => row.tokenHash === sha256(keep.token));
      const dropped = prisma.rows.find((row) => row.tokenHash === sha256(other.token));
      expect(kept?.revokedAt).toBeNull();
      expect(dropped?.revokedAt).toBeInstanceOf(Date);
    });
  });
});
