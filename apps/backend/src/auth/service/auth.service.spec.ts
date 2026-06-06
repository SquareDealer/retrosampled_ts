import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from './token.service';
import { MailService } from './mail.service';

const prisma = {
  user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  profile: { findUnique: jest.fn() },
  refreshToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  emailToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  // Run the callback against the same mock client.
  $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
} as unknown as PrismaService;

const tokens = {
  signAccessToken: jest.fn(() => ({ token: 'access-token', expiresIn: 3600 })),
  createRefreshToken: jest.fn(() => ({
    raw: 'raw-refresh',
    hash: 'hashed-refresh',
    expiresAt: new Date(Date.now() + 100000),
  })),
  hash: jest.fn((v: string) => `hash:${v}`),
} as unknown as TokenService;

const mail = {
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
} as unknown as MailService;

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(prisma, tokens, mail);
  });

  describe('signUp', () => {
    it('rejects a duplicate email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1' });
      await expect(service.signUp('a@b.dev', 'secret123')).rejects.toThrow(
        /already registered/,
      );
    });

    it('creates a user, issues a verification token and a session', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'u1',
        email: 'a@b.dev',
      });

      const result = await service.signUp('a@b.dev', 'secret123');

      expect(prisma.user.create).toHaveBeenCalled();
      expect(mail.sendVerificationEmail).toHaveBeenCalled();
      expect(result.user).toEqual({ id: 'u1', email: 'a@b.dev' });
      expect(result.session.access_token).toBe('access-token');
      expect(result.session.refresh_token).toBe('raw-refresh');
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('rejects an unknown user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.login('a@b.dev', 'secret123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a wrong password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        email: 'a@b.dev',
        passwordHash: await bcrypt.hash('correct-password', 10),
      });
      await expect(service.login('a@b.dev', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('issues a session on valid credentials', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        email: 'a@b.dev',
        passwordHash: await bcrypt.hash('correct-password', 10),
      });
      const session = await service.login('a@b.dev', 'correct-password');
      expect(session.access_token).toBe('access-token');
      expect(session.user).toEqual({ id: 'u1', email: 'a@b.dev' });
    });
  });

  describe('refresh', () => {
    it('rejects an unknown refresh token', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.refresh('raw-refresh')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a revoked refresh token', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 100000),
        user: { id: 'u1', email: 'a@b.dev' },
      });
      await expect(service.refresh('raw-refresh')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rotates a valid refresh token into a new session', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
        user: { id: 'u1', email: 'a@b.dev' },
      });
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const session = await service.refresh('raw-refresh');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'rt1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(session.access_token).toBe('access-token');
    });
  });

  describe('resetPassword', () => {
    it('rejects an invalid or used token', async () => {
      (prisma.emailToken.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.resetPassword('tok', 'newpass123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('updates the password and revokes sessions on a valid token', async () => {
      (prisma.emailToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'et1',
        userId: 'u1',
        type: 'RESET_PASSWORD',
        usedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });
      (prisma.emailToken.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      await service.resetPassword('tok', 'newpass123');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { passwordHash: expect.any(String) },
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    });
  });
});
