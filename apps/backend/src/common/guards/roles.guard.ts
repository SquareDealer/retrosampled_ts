import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, can } from '@retrosampled/shared';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Enforces `@Roles(...)` on a route (handler metadata wins over class metadata).
 *
 * - routes without `@Roles()` are untouched — ownership rules live in the
 *   services, through `can()` / `SampleAccessService`;
 * - `@Public()` short-circuits: a route explicitly opened to guests never has a
 *   `req.user` to check;
 * - no authenticated user on a `@Roles()` route → 401 (the caller may simply not
 *   have sent a token, e.g. on an `@OptionalAuth()` route);
 * - authenticated but with the wrong role → 403;
 * - `ADMIN` satisfies any `@Roles()` list, matching the admin bypass in `can()`.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Missing access token');
    }

    // Admins pass every role gate; `can(actor, 'admin:any')` is the same rule the
    // frontend uses to decide whether to render admin-only affordances.
    if (can({ id: user.id, role: user.role }, 'admin:any')) {
      return true;
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
