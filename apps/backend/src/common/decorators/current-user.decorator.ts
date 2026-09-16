import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import {
  AuthenticatedRequest,
  RequestUser,
} from '../types/authenticated-request';

/**
 * Injects `req.user`. On `@OptionalAuth()` routes it can be `undefined`, so
 * declare the parameter as `RequestUser | undefined` there.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      return undefined;
    }

    return data ? user[data] : user;
  },
);
