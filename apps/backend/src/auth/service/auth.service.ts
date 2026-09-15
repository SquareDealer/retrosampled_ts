import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { User } from '@prisma/client';
import { UserRole } from '@retrosampled/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from './token.service';

const BCRYPT_ROUNDS = 10;
const MAX_USERNAME_LENGTH = 16;

export type AuthUserPayload = {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  avatarUrl: string | null;
};

export type AuthSession = {
  user: AuthUserPayload;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  private toAuthUser(user: User): AuthUserPayload {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role as UserRole,
      avatarUrl: user.avatarKey ?? null,
    };
  }

  private async createSession(user: User, familyId?: string): Promise<AuthSession> {
    const accessToken = await this.tokenService.signAccessToken({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    const refresh = await this.tokenService.issueRefreshToken(user.id, familyId);

    return {
      user: this.toAuthUser(user),
      accessToken,
      refreshToken: refresh.token,
      expiresIn: this.tokenService.accessTtlSeconds,
    };
  }

  /** `Some.User+tag@mail.com` → `someuser`, with a numeric suffix on clash. */
  private async generateUsername(email: string, requested?: string): Promise<string> {
    const base = (requested ?? email.split('@')[0] ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, MAX_USERNAME_LENGTH);

    const seed = base.length > 0 ? base : 'user';

    if (!(await this.prisma.user.findUnique({ where: { username: seed } }))) {
      return seed;
    }

    if (requested) {
      throw new ConflictException('Username already taken');
    }

    for (let suffix = 2; suffix < 10000; suffix += 1) {
      const candidate = `${seed.slice(
        0,
        MAX_USERNAME_LENGTH - String(suffix).length,
      )}${suffix}`;

      if (!(await this.prisma.user.findUnique({ where: { username: candidate } }))) {
        return candidate;
      }
    }

    throw new ConflictException('Username already taken');
  }

  async register(
    email: string,
    password: string,
    username?: string,
  ): Promise<AuthSession> {
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const resolvedUsername = await this.generateUsername(normalizedEmail, username);
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        username: resolvedUsername,
        role: 'USER',
        links: '{}',
      },
    });

    return this.createSession(user);
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.createSession(user);
  }

  /** Rotates the refresh token and mints a fresh access token. */
  async refresh(refreshToken: string): Promise<AuthSession> {
    const { userId, refresh } = await this.tokenService.rotateRefreshToken(
      refreshToken,
    );

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      await this.tokenService.revokeFamily(refresh.familyId);
      throw new UnauthorizedException('Refresh token invalid/expired');
    }

    const accessToken = await this.tokenService.signAccessToken({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    return {
      user: this.toAuthUser(user),
      accessToken,
      refreshToken: refresh.token,
      expiresIn: this.tokenService.accessTtlSeconds,
    };
  }

  async logout(refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.tokenService.revokeByToken(refreshToken);
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid token');
    }

    return {
      sub: user.id,
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName ?? null,
      avatarUrl: user.avatarKey ?? null,
      role: user.role as UserRole,
    };
  }

  /**
   * Changes the password and revokes every other session of the account. The
   * caller's own session survives when its refresh token is passed in.
   */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
    currentRefreshToken?: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid token');
    }

    const matches = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!matches) {
      throw new BadRequestException('Old password is incorrect');
    }

    if (oldPassword === newPassword) {
      throw new BadRequestException('New password must differ from the old one');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) },
    });

    const current = currentRefreshToken
      ? await this.tokenService.findRefreshToken(currentRefreshToken)
      : null;

    await this.tokenService.revokeAllForUser(user.id, {
      exceptFamilyId: current?.familyId,
    });
  }

  /** Soft delete: the row stays, the account is deactivated and logged out. */
  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid token');
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new BadRequestException('Password is incorrect');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { isActive: false },
    });

    await this.tokenService.revokeAllForUser(user.id);
  }
}
