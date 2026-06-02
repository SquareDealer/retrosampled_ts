import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { EmailTokenType, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from './token.service';
import { MailService } from './mail.service';

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'bearer';
  user: { id: string; email: string };
};

const BCRYPT_ROUNDS = 10;
const EMAIL_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
  ) {}

  // --- Registration / login ----------------------------------------------

  async signUp(
    email: string,
    password: string,
    username?: string,
  ): Promise<{ user: { id: string; email: string }; session: AuthSession }> {
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const finalUsername = await this.resolveUsername(username, normalizedEmail);

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        profile: { create: { username: finalUsername } },
      },
    });

    // Issue a verification token (link logged to console in dev).
    await this.issueEmailToken(user, EmailTokenType.VERIFY_EMAIL, (token) =>
      this.mail.sendVerificationEmail(user.email, token),
    );

    const session = await this.createSession(user);
    return { user: { id: user.id, email: user.email }, session };
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.createSession(user);
  }

  // --- Sessions / refresh tokens ------------------------------------------

  async refresh(rawRefreshToken: string): Promise<AuthSession> {
    const tokenHash = this.tokens.hash(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Refresh token invalid/expired');
    }

    // Rotate: revoke the old token, then mint a fresh session.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.createSession(stored.user);
  }

  async logout(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }
    const tokenHash = this.tokens.hash(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // --- Password / account management --------------------------------------

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    // Do not leak whether the account exists.
    if (!user) {
      return;
    }
    await this.issueEmailToken(user, EmailTokenType.RESET_PASSWORD, (token) =>
      this.mail.sendPasswordResetEmail(user.email, token),
    );
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await this.consumeEmailToken(
      token,
      EmailTokenType.RESET_PASSWORD,
    );
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    });
    // Invalidate all existing sessions after a password reset.
    await this.prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(oldPassword, user.passwordHash))) {
      throw new BadRequestException('Old password is incorrect');
    }
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async updateUser(
    userId: string,
    data: { email?: string; password?: string },
  ): Promise<{ id: string; email: string }> {
    const patch: { email?: string; passwordHash?: string } = {};

    if (data.email) {
      const normalizedEmail = data.email.trim().toLowerCase();
      const clash = await this.prisma.user.findFirst({
        where: { email: normalizedEmail, NOT: { id: userId } },
      });
      if (clash) {
        throw new BadRequestException('Email already in use');
      }
      patch.email = normalizedEmail;
    }

    if (data.password) {
      patch.passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: patch,
    });
    return { id: user.id, email: user.email };
  }

  async deleteUser(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new BadRequestException('Password is incorrect');
    }
    await this.prisma.user.delete({ where: { id: userId } });
  }

  async sendVerificationEmail(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    await this.issueEmailToken(user, EmailTokenType.VERIFY_EMAIL, (token) =>
      this.mail.sendVerificationEmail(user.email, token),
    );
  }

  async verifyEmail(token: string): Promise<void> {
    const record = await this.consumeEmailToken(
      token,
      EmailTokenType.VERIFY_EMAIL,
    );
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    });
  }

  // --- internals ----------------------------------------------------------

  private async createSession(user: User): Promise<AuthSession> {
    const access = this.tokens.signAccessToken(user);
    const refresh = this.tokens.createRefreshToken();

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refresh.hash,
        expiresAt: refresh.expiresAt,
      },
    });

    return {
      access_token: access.token,
      refresh_token: refresh.raw,
      expires_in: access.expiresIn,
      token_type: 'bearer',
      user: { id: user.id, email: user.email },
    };
  }

  private async issueEmailToken(
    user: User,
    type: EmailTokenType,
    send: (rawToken: string) => void,
  ): Promise<void> {
    const raw = randomBytes(32).toString('base64url');
    await this.prisma.emailToken.create({
      data: {
        userId: user.id,
        type,
        tokenHash: this.tokens.hash(raw),
        expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
      },
    });
    send(raw);
  }

  private async consumeEmailToken(rawToken: string, type: EmailTokenType) {
    const tokenHash = this.tokens.hash(rawToken);
    const record = await this.prisma.emailToken.findUnique({
      where: { tokenHash },
    });

    if (
      !record ||
      record.type !== type ||
      record.usedAt ||
      record.expiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException('Token is invalid or expired');
    }

    await this.prisma.emailToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return record;
  }

  private async resolveUsername(
    requested: string | undefined,
    email: string,
  ): Promise<string> {
    const base =
      (requested?.trim() || email.split('@')[0])
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 16) || 'user';

    let candidate = base;
    let suffix = 0;
    // Ensure uniqueness — append a numeric suffix on collision.
    while (
      await this.prisma.profile.findUnique({ where: { username: candidate } })
    ) {
      suffix += 1;
      candidate = `${base.slice(0, 12)}${suffix}`;
    }
    return candidate;
  }
}
