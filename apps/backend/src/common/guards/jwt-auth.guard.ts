import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TokenService } from '../../auth/service/token.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { OPTIONAL_AUTH_KEY } from '../decorators/optional-auth.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Global authentication guard.
 *
 * - `@Public()` routes are skipped entirely.
 * - `@OptionalAuth()` routes attach `req.user` when a valid token is present and
 *   never throw.
 * - Everything else requires a valid access token, taken from the
 *   `Authorization: Bearer` header first and from the `access_token` cookie next.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    protected readonly reflector: Reflector,
    protected readonly tokenService: TokenService,
  ) {}

  protected isOptional(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const optional = this.isOptional(context);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      if (optional) {
        return true;
      }
      throw new UnauthorizedException('Missing access token');
    }

    try {
      request.user = await this.tokenService.verifyAccessToken(token);
      request.token = token;
      return true;
    } catch (error) {
      if (optional) {
        return true;
      }
      throw error;
    }
  }

  private extractToken(request: AuthenticatedRequest): string | null {
    const header = request.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      const fromHeader = header.slice('Bearer '.length).trim();
      if (fromHeader) {
        return fromHeader;
      }
    }

    const cookieToken = (request.cookies as Record<string, string> | undefined)?.[
      'access_token'
    ];

    return cookieToken ? cookieToken : null;
  }
}
