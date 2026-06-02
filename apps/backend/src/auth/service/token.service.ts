import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, createHash, timingSafeEqual } from 'crypto';

export type AccessTokenPayload = {
  sub: string;
  email: string;
  iat: number;
  exp: number;
};

/**
 * Issues and verifies the application's own tokens.
 *
 * Access tokens are stateless HS256 JWTs (signed with JWT_SECRET).
 * Refresh tokens are opaque random strings; only their SHA-256 hash is
 * persisted, so the raw value lives solely in the user's cookie.
 */
@Injectable()
export class TokenService {
  private readonly secret: string;
  readonly accessTtl: number;
  readonly refreshTtl: number;

  constructor(private readonly config: ConfigService) {
    this.secret = this.config.get<string>('JWT_SECRET') as string;
    this.accessTtl = Number(this.config.get('JWT_ACCESS_TTL') ?? 3600);
    this.refreshTtl = Number(
      this.config.get('JWT_REFRESH_TTL') ?? 60 * 60 * 24 * 30,
    );
  }

  // --- Access token (JWT, HS256) ------------------------------------------

  signAccessToken(user: { id: string; email: string }): {
    token: string;
    expiresIn: number;
  } {
    const now = Math.floor(Date.now() / 1000);
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      iat: now,
      exp: now + this.accessTtl,
    };

    const header = this.base64url(
      JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
    );
    const body = this.base64url(JSON.stringify(payload));
    const signature = this.sign(`${header}.${body}`);

    return {
      token: `${header}.${body}.${signature}`,
      expiresIn: this.accessTtl,
    };
  }

  verifyAccessToken(token: string): AccessTokenPayload | null {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [header, body, signature] = parts;
    const expected = this.sign(`${header}.${body}`);

    if (!this.safeEqual(signature, expected)) {
      return null;
    }

    let payload: AccessTokenPayload;
    try {
      payload = JSON.parse(
        Buffer.from(body, 'base64url').toString('utf-8'),
      ) as AccessTokenPayload;
    } catch {
      return null;
    }

    if (
      !payload?.sub ||
      typeof payload.exp !== 'number' ||
      payload.exp * 1000 <= Date.now()
    ) {
      return null;
    }

    return payload;
  }

  // --- Refresh tokens (opaque) --------------------------------------------

  createRefreshToken(): { raw: string; hash: string; expiresAt: Date } {
    const raw = randomBytes(48).toString('base64url');
    return {
      raw,
      hash: this.hash(raw),
      expiresAt: new Date(Date.now() + this.refreshTtl * 1000),
    };
  }

  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  // --- internals ----------------------------------------------------------

  private sign(data: string): string {
    return createHmac('sha256', this.secret).update(data).digest('base64url');
  }

  private base64url(value: string): string {
    return Buffer.from(value, 'utf-8').toString('base64url');
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  }
}
