import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'southkid@example.com',
    passwordHash: bcrypt.hashSync('user123', 4),
    role: 'USER',
    username: 'southkid',
    displayName: null,
    avatarKey: null,
    bio: null,
    links: '{}',
    followersCount: 0,
    followingCount: 0,
    uploadsCount: 0,
    remakesCount: 0,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createPrismaMock(users: User[] = []) {
  return {
    users,
    user: {
      findUnique: jest.fn(async ({ where }: { where: Partial<User> }) => {
        return (
          users.find(
            (user) =>
              (where.id !== undefined && user.id === where.id) ||
              (where.email !== undefined && user.email === where.email) ||
              (where.username !== undefined && user.username === where.username),
          ) ?? null
        );
      }),
      create: jest.fn(async ({ data }: { data: Partial<User> }) => {
        const created = makeUser({ id: `user-${users.length + 1}`, ...data });
        users.push(created);
        return created;
      }),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<User> }) => {
          const user = users.find((item) => item.id === where.id);
          if (!user) {
            throw new Error('not found');
          }
          Object.assign(user, data);
          return user;
        },
      ),
    },
  };
}

function createTokenMock() {
  return {
    accessTtlSeconds: 900,
    signAccessToken: jest.fn(async () => 'signed.access.token'),
    issueRefreshToken: jest.fn(async (userId: string, familyId = 'family-1') => ({
      id: 'refresh-1',
      token: 'refresh-token',
      familyId,
      expiresAt: new Date(Date.now() + 1000),
    })),
    rotateRefreshToken: jest.fn(),
    findRefreshToken: jest.fn(),
    revokeFamily: jest.fn(),
    revokeByToken: jest.fn(),
    revokeAllForUser: jest.fn(),
  };
}

describe('AuthService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let tokens: ReturnType<typeof createTokenMock>;
  let service: AuthService;

  const build = (users: User[] = []) => {
    prisma = createPrismaMock(users);
    tokens = createTokenMock();
    service = new AuthService(
      prisma as unknown as PrismaService,
      tokens as unknown as TokenService,
    );
  };

  beforeEach(() => build());

  describe('register', () => {
    it('derives the username from the email local part', async () => {
      const session = await service.register('South.Kid+demo@Example.com', 'secret1');

      expect(session.user.username).toBe('southkiddemo');
      expect(session.user.email).toBe('south.kid+demo@example.com');
      expect(session.user.role).toBe('USER');
      expect(session.accessToken).toBe('signed.access.token');
      expect(session.refreshToken).toBe('refresh-token');
      expect(session.expiresIn).toBe(900);
    });

    it('appends a numeric suffix when the generated username is taken', async () => {
      build([makeUser({ username: 'southkid' })]);

      const session = await service.register('southkid@other.com', 'secret1');

      expect(session.user.username).toBe('southkid2');
    });

    it('rejects a duplicate email', async () => {
      build([makeUser()]);

      await expect(
        service.register('southkid@example.com', 'secret1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects an explicitly requested username that is taken', async () => {
      build([makeUser({ username: 'southkid' })]);

      await expect(
        service.register('new@example.com', 'secret1', 'southkid'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('returns a session for valid credentials', async () => {
      build([makeUser()]);

      const session = await service.login('SouthKid@example.com', 'user123');

      expect(session.user.id).toBe('user-1');
      expect(session.user.username).toBe('southkid');
    });

    it('rejects a wrong password', async () => {
      build([makeUser()]);

      await expect(
        service.login('southkid@example.com', 'nope'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a deactivated account', async () => {
      build([makeUser({ isActive: false })]);

      await expect(
        service.login('southkid@example.com', 'user123'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an unknown email', async () => {
      await expect(
        service.login('ghost@example.com', 'user123'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('changePassword', () => {
    it('rehashes the password and revokes the other sessions', async () => {
      const user = makeUser();
      build([user]);
      tokens.findRefreshToken.mockResolvedValue({ familyId: 'family-current' });

      await service.changePassword('user-1', 'user123', 'brand-new', 'raw-refresh');

      expect(bcrypt.compareSync('brand-new', user.passwordHash)).toBe(true);
      expect(tokens.revokeAllForUser).toHaveBeenCalledWith('user-1', {
        exceptFamilyId: 'family-current',
      });
    });

    it('rejects a wrong current password', async () => {
      build([makeUser()]);

      await expect(
        service.changePassword('user-1', 'wrong', 'brand-new'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tokens.revokeAllForUser).not.toHaveBeenCalled();
    });
  });

  describe('deleteAccount', () => {
    it('soft deletes and revokes every session', async () => {
      const user = makeUser();
      build([user]);

      await service.deleteAccount('user-1', 'user123');

      expect(user.isActive).toBe(false);
      expect(tokens.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });

    it('rejects a wrong password', async () => {
      build([makeUser()]);

      await expect(
        service.deleteAccount('user-1', 'nope'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('me', () => {
    it('returns the session shape with sub and id', async () => {
      build([makeUser()]);

      await expect(service.me('user-1')).resolves.toMatchObject({
        sub: 'user-1',
        id: 'user-1',
        username: 'southkid',
        role: 'USER',
      });
    });

    it('rejects a deactivated account', async () => {
      build([makeUser({ isActive: false })]);

      await expect(service.me('user-1')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
