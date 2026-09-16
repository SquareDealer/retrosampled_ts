import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash, randomUUID } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { UserRole, isUserRole } from '@retrosampled/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/types/authenticated-request';

export const JWT_ISSUER = 'retrosampled';
export const JWT_AUDIENCE = 'retrosampled-web';

export type AccessTokenSubject = {
  id: string;
  email: string;
  username: string;
  role: string;
};

export type AccessTokenPayload = {
  sub: string;
  email: string;
  username: string;
  role: UserRole;
};

export type IssuedRefreshToken = {
  id: string;
  token: string;
  familyId: string;
  expiresAt: Date;
};

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  get accessTtlSeconds(): number {
    return Number(this.configService.get('JWT_ACCESS_TTL') ?? 900);
  }

  get refreshTtlSeconds(): number {
    return Number(this.configService.get('JWT_REFRESH_TTL') ?? 2592000);
  }

  private get secret(): Uint8Array {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }
    return new TextEncoder().encode(secret);
  }

  /** HS256 access token: iss `retrosampled`, aud `retrosampled-web`. */
  async signAccessToken(user: AccessTokenSubject): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    return new SignJWT({
      email: user.email,
      username: user.username,
      role: user.role,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(user.id)
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(now + this.accessTtlSeconds)
      .sign(this.secret);
  }

  async verifyAccessToken(token: string): Promise<RequestUser> {
    let payload: Record<string, unknown>;

    try {
      const result = await jwtVerify(token, this.secret, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        algorithms: ['HS256'],
      });
      payload = result.payload as Record<string, unknown>;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    const sub = payload.sub;
    const email = payload.email;
    const username = payload.username;
    const role = payload.role;

    if (
      typeof sub !== 'string' ||
      typeof email !== 'string' ||
      typeof username !== 'string' ||
      !isUserRole(role)
    ) {
      throw new UnauthorizedException('Invalid token');
    }

    return { sub, id: sub, email, username, role };
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Issues an opaque refresh token (32 random bytes); only its sha256 is stored. */
  async issueRefreshToken(
    userId: string,
    familyId: string = randomUUID(),
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.refreshTtlSeconds * 1000);

    const created = await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hash(token),
        userId,
        familyId,
        expiresAt,
      },
    });

    return { id: created.id, token, familyId, expiresAt };
  }

  /**
   * Rotates a refresh token. Presenting a token that was already rotated (or
   * revoked) is treated as theft: the whole family is revoked and the caller
   * has to log in again.
   */
  async rotateRefreshToken(
    rawToken: string,
  ): Promise<{ userId: string; refresh: IssuedRefreshToken }> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(rawToken) },
    });

    if (!stored) {
      throw new UnauthorizedException('Refresh token invalid/expired');
    }

    if (stored.revokedAt) {
      await this.revokeFamily(stored.familyId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      await this.revokeFamily(stored.familyId);
      throw new UnauthorizedException('Refresh token invalid/expired');
    }

    const refresh = await this.issueRefreshToken(stored.userId, stored.familyId);

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedById: refresh.id },
    });

    return { userId: stored.userId, refresh };
  }

  async findRefreshToken(rawToken: string) {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(rawToken) },
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Used by logout when the presented token is already unknown/rotated. */
  async revokeByToken(rawToken: string): Promise<void> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(rawToken) },
      select: { familyId: true },
    });

    if (stored) {
      await this.revokeFamily(stored.familyId);
    }
  }

  async revokeAllForUser(
    userId: string,
    options: { exceptFamilyId?: string } = {},
  ): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(options.exceptFamilyId
          ? { NOT: { familyId: options.exceptFamilyId } }
          : {}),
      },
      data: { revokedAt: new Date() },
    });
  }
}
