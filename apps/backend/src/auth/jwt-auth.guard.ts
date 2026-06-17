import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { TokenService } from './service/token.service';

export type AuthenticatedRequest = Request & {
  user?: { sub: string; email: string; [key: string]: unknown };
  token?: string;
};

/**
 * Verifies the application's own HS256 access tokens.
 *
 * The token is read from the `Authorization: Bearer` header or the
 * `access_token` cookie. On success `req.user` is populated with the JWT
 * payload (which contains `sub` = user id and `email`).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

    const auth = req.headers['authorization'] as string | undefined;
    let token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;

    if (!token && req.cookies?.['access_token']) {
      token = req.cookies['access_token'];
    }

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    const payload = this.tokens.verifyAccessToken(token);
    if (!payload) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    req.user = payload;
    req.token = token;
    return true;
  }
}
