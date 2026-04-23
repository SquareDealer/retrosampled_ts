import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { createPublicKey, createVerify } from 'crypto';

type AuthenticatedRequest = Request & {
  user?: Record<string, unknown>;
  token?: string;
};

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly supabaseUrl = process.env.SUPABASE_URL;
  private readonly issuer = this.supabaseUrl
    ? `${this.supabaseUrl.replace(/\/$/, '')}/auth/v1`
    : null;
  private readonly jwksUrl = this.issuer
    ? `${this.issuer}/.well-known/jwks.json`
    : null;
  private cachedPemByKid = new Map<string, string>();
  private cacheExpiresAt = 0;
  private static readonly JWKS_CACHE_TTL_MS = 5 * 60 * 1000;

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

    const auth = req.headers['authorization'] as string | undefined;
    let token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;

    if (!token && req.cookies?.['access_token']) {
      token = req.cookies['access_token'];
    }

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    if (!this.jwksUrl || !this.issuer) {
      throw new InternalServerErrorException('JWT verification is not configured');
    }

    try {
      const header = this.decodeTokenPart(token, 0);
      const payload = this.decodeTokenPart(token, 1);

      const kid = this.getHeaderKid(header);
      const publicKey = await this.getPublicKeyByKid(kid);

      if (!this.verifySignature(token, publicKey)) {
        throw new UnauthorizedException('Token signature invalid');
      }

      this.validateClaims(payload);

      req.user = payload;
      req.token = token;

      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private decodeTokenPart(token: string, index: 0 | 1): Record<string, unknown> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Invalid token format');
    }

    try {
      return JSON.parse(Buffer.from(parts[index], 'base64url').toString('utf-8'));
    } catch {
      throw new UnauthorizedException('Invalid token payload');
    }
  }

  private getHeaderKid(header: Record<string, unknown>): string {
    const kid = header.kid;
    if (typeof kid !== 'string' || kid.length === 0) {
      throw new UnauthorizedException('Token key id missing');
    }
    return kid;
  }

  private async getPublicKeyByKid(kid: string): Promise<string> {
    const now = Date.now();

    if (this.cachedPemByKid.has(kid) && now < this.cacheExpiresAt) {
      return this.cachedPemByKid.get(kid)!;
    }

    const response = await fetch(this.jwksUrl!);
    if (!response.ok) {
      throw new InternalServerErrorException('Unable to fetch JWKS');
    }

    const jwks = (await response.json()) as {
      keys?: Array<Record<string, unknown>>;
    };

    if (!Array.isArray(jwks.keys)) {
      throw new InternalServerErrorException('Invalid JWKS response');
    }

    this.cachedPemByKid.clear();
    for (const key of jwks.keys) {
      const currentKid = key.kid;
      if (typeof currentKid === 'string' && currentKid.length > 0) {
        const pem = this.jwkToPem(key);
        this.cachedPemByKid.set(currentKid, pem);
      }
    }

    this.cacheExpiresAt = now + SupabaseAuthGuard.JWKS_CACHE_TTL_MS;

    const key = this.cachedPemByKid.get(kid);
    if (!key) {
      throw new UnauthorizedException('Token key not recognized');
    }

    return key;
  }

  private jwkToPem(jwk: Record<string, unknown>): string {
    const publicKey = createPublicKey({
      key: jwk,
      format: 'jwk',
    });

    return publicKey.export({ format: 'pem', type: 'spki' }).toString();
  }

  private verifySignature(token: string, publicKey: string): boolean {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    verifier.end();

    const signature = Buffer.from(parts[2], 'base64url');
    return verifier.verify(publicKey, signature);
  }

  private validateClaims(payload: Record<string, unknown>): void {
    if (!this.issuer) {
      throw new InternalServerErrorException('Token issuer is not configured');
    }

    const iss = payload.iss;
    if (typeof iss !== 'string' || iss !== this.issuer) {
      throw new UnauthorizedException('Token issuer invalid');
    }

    const aud = payload.aud;
    const hasExpectedAudience =
      aud === 'authenticated' ||
      (Array.isArray(aud) && aud.includes('authenticated'));

    if (!hasExpectedAudience) {
      throw new UnauthorizedException('Token audience invalid');
    }

    const exp = payload.exp;
    if (typeof exp !== 'number' || exp * 1000 <= Date.now()) {
      throw new UnauthorizedException('Token expired');
    }
  }
}