import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedRequest, RequestUser } from '../types/authenticated-request';
import { RolesGuard } from './roles.guard';

const USER: RequestUser = {
  sub: 'user-1',
  id: 'user-1',
  email: 'southkid@example.com',
  username: 'southkid',
  role: 'USER',
};

const ADMIN: RequestUser = {
  sub: 'admin-1',
  id: 'admin-1',
  email: 'admin@example.com',
  username: 'admin',
  role: 'ADMIN',
};

function createContext(
  user?: RequestUser,
  type: 'http' | 'ws' = 'http',
): ExecutionContext {
  const request = { headers: {}, cookies: {}, user } as AuthenticatedRequest;

  return {
    getType: () => type,
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function createReflector(metadata: Record<string, unknown> = {}): Reflector {
  return {
    getAllAndOverride: (key: string) => metadata[key],
  } as unknown as Reflector;
}

describe('RolesGuard', () => {
  it('ignores routes without @Roles()', () => {
    const guard = new RolesGuard(createReflector());

    expect(guard.canActivate(createContext())).toBe(true);
    expect(guard.canActivate(createContext(USER))).toBe(true);
  });

  it('ignores an empty @Roles() list', () => {
    const guard = new RolesGuard(createReflector({ [ROLES_KEY]: [] }));

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('skips non-http contexts', () => {
    const guard = new RolesGuard(createReflector({ [ROLES_KEY]: ['ADMIN'] }));

    expect(guard.canActivate(createContext(undefined, 'ws'))).toBe(true);
  });

  it('throws 401 when the route is guarded and nobody is signed in', () => {
    const guard = new RolesGuard(createReflector({ [ROLES_KEY]: ['ADMIN'] }));

    expect(() => guard.canActivate(createContext())).toThrow(UnauthorizedException);
  });

  it('throws 403 when the role does not match', () => {
    const guard = new RolesGuard(createReflector({ [ROLES_KEY]: ['ADMIN'] }));

    expect(() => guard.canActivate(createContext(USER))).toThrow(ForbiddenException);
  });

  it('lets a matching role through', () => {
    const guard = new RolesGuard(createReflector({ [ROLES_KEY]: ['USER'] }));

    expect(guard.canActivate(createContext(USER))).toBe(true);
  });

  it('lets ADMIN through any @Roles() list', () => {
    const guard = new RolesGuard(createReflector({ [ROLES_KEY]: ['USER'] }));

    expect(guard.canActivate(createContext(ADMIN))).toBe(true);
  });

  it('lets ADMIN through an @Roles("ADMIN") route', () => {
    const guard = new RolesGuard(createReflector({ [ROLES_KEY]: ['ADMIN'] }));

    expect(guard.canActivate(createContext(ADMIN))).toBe(true);
  });

  it('does not fight @Public(): an open route stays open', () => {
    const guard = new RolesGuard(
      createReflector({ [ROLES_KEY]: ['ADMIN'], [IS_PUBLIC_KEY]: true }),
    );

    expect(guard.canActivate(createContext())).toBe(true);
  });
});
