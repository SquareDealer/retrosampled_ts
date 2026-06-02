import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokenService } from './service/token.service';

type FakeRequest = {
  headers: Record<string, string | undefined>;
  cookies?: Record<string, string>;
  user?: unknown;
  token?: string;
};

const contextFor = (req: FakeRequest): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => req }),
  }) as unknown as ExecutionContext;

const tokens = {
  verifyAccessToken: jest.fn(),
} as unknown as TokenService;

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jest.resetAllMocks();
    guard = new JwtAuthGuard(tokens);
  });

  it('throws when no token is present', () => {
    const req: FakeRequest = { headers: {} };
    expect(() => guard.canActivate(contextFor(req))).toThrow(
      UnauthorizedException,
    );
  });

  it('accepts a valid bearer token and populates req.user', () => {
    (tokens.verifyAccessToken as jest.Mock).mockReturnValue({
      sub: 'user-1',
      email: 'a@b.dev',
    });
    const req: FakeRequest = { headers: { authorization: 'Bearer good' } };

    expect(guard.canActivate(contextFor(req))).toBe(true);
    expect(req.user).toMatchObject({ sub: 'user-1' });
    expect(req.token).toBe('good');
  });

  it('falls back to the access_token cookie', () => {
    (tokens.verifyAccessToken as jest.Mock).mockReturnValue({
      sub: 'user-2',
      email: 'c@d.dev',
    });
    const req: FakeRequest = { headers: {}, cookies: { access_token: 'cookie' } };

    expect(guard.canActivate(contextFor(req))).toBe(true);
    expect(tokens.verifyAccessToken).toHaveBeenCalledWith('cookie');
  });

  it('rejects an invalid token', () => {
    (tokens.verifyAccessToken as jest.Mock).mockReturnValue(null);
    const req: FakeRequest = { headers: { authorization: 'Bearer bad' } };
    expect(() => guard.canActivate(contextFor(req))).toThrow(
      UnauthorizedException,
    );
  });
});
