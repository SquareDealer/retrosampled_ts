import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { TokenService } from './service/token.service';
import { AuthenticatedRequest } from './jwt-auth.guard';

/**
 * Populates `req.user` when a valid access token is present but never rejects
 * the request. Used for endpoints that are public yet personalised when the
 * caller is signed in (e.g. the feed's `isLiked` flag).
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

    const auth = req.headers['authorization'] as string | undefined;
    let token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token && req.cookies?.['access_token']) {
      token = req.cookies['access_token'];
    }

    if (token) {
      const payload = this.tokens.verifyAccessToken(token);
      if (payload) {
        req.user = payload;
        req.token = token;
      }
    }

    return true;
  }
}
