import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TokenService } from '../../auth/service/token.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { OPTIONAL_AUTH_KEY } from '../decorators/optional-auth.decorator';
import { AuthenticatedRequest, RequestUser } from '../types/authenticated-request';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OptionalAuthGuard } from './optional-auth.guard';

const USER: RequestUser = {
  sub: 'user-1',
  id: 'user-1',
  email: 'southkid@example.com',
  username: 'southkid',
  role: 'USER',
};

function createContext(request: Partial<AuthenticatedRequest>): ExecutionContext {
  const req = { headers: {}, cookies: {}, ...request } as AuthenticatedRequest;

  return {
    getType: () => 'http',
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function createReflector(metadata: Record<string, unknown> = {}): Reflector {
  return {
    getAllAndOverride: (key: string) => metadata[key],
  } as unknown as Reflector;
}

describe('JwtAuthGuard', () => {
  const tokenService = {
    verifyAccessToken: jest.fn(),
  } as unknown as TokenService;

  beforeEach(() => {
    (tokenService.verifyAccessToken as jest.Mock).mockReset();
    (tokenService.verifyAccessToken as jest.Mock).mockResolvedValue(USER);
  });

  it('lets @Public() routes through without touching the token', async () => {
    const guard = new JwtAuthGuard(
      createReflector({ [IS_PUBLIC_KEY]: true }),
      tokenService,
    );
    const context = createContext({ headers: {} });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('prefers the Authorization header', async () => {
    const guard = new JwtAuthGuard(createReflector(), tokenService);
    const request = {
      headers: { authorization: 'Bearer header-token' },
      cookies: { access_token: 'cookie-token' },
    };
    const context = createContext(request);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(tokenService.verifyAccessToken).toHaveBeenCalledWith('header-token');
    expect(
      (context.switchToHttp().getRequest() as AuthenticatedRequest).user,
    ).toEqual(USER);
  });

  it('falls back to the access_token cookie', async () => {
    const guard = new JwtAuthGuard(createReflector(), tokenService);
    const context = createContext({ cookies: { access_token: 'cookie-token' } });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(tokenService.verifyAccessToken).toHaveBeenCalledWith('cookie-token');
  });

  it('throws when no token is present', async () => {
    const guard = new JwtAuthGuard(createReflector(), tokenService);

    await expect(guard.canActivate(createContext({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws when the token does not verify', async () => {
    (tokenService.verifyAccessToken as jest.Mock).mockRejectedValue(
      new UnauthorizedException('Invalid token'),
    );
    const guard = new JwtAuthGuard(createReflector(), tokenService);
    const context = createContext({ cookies: { access_token: 'bad' } });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  describe('@OptionalAuth()', () => {
    it('allows guests without attaching a user', async () => {
      const guard = new JwtAuthGuard(
        createReflector({ [OPTIONAL_AUTH_KEY]: true }),
        tokenService,
      );
      const context = createContext({});

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(
        (context.switchToHttp().getRequest() as AuthenticatedRequest).user,
      ).toBeUndefined();
    });

    it('attaches the user when the token is valid', async () => {
      const guard = new JwtAuthGuard(
        createReflector({ [OPTIONAL_AUTH_KEY]: true }),
        tokenService,
      );
      const context = createContext({ cookies: { access_token: 'good' } });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(
        (context.switchToHttp().getRequest() as AuthenticatedRequest).user,
      ).toEqual(USER);
    });

    it('swallows an invalid token instead of throwing', async () => {
      (tokenService.verifyAccessToken as jest.Mock).mockRejectedValue(
        new UnauthorizedException('Invalid token'),
      );
      const guard = new JwtAuthGuard(
        createReflector({ [OPTIONAL_AUTH_KEY]: true }),
        tokenService,
      );

      await expect(
        guard.canActivate(createContext({ cookies: { access_token: 'bad' } })),
      ).resolves.toBe(true);
    });
  });

  describe('OptionalAuthGuard', () => {
    it('never throws even without the decorator metadata', async () => {
      const guard = new OptionalAuthGuard(createReflector(), tokenService);

      await expect(guard.canActivate(createContext({}))).resolves.toBe(true);
    });
  });
});
