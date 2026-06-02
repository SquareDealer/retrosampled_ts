import { ExecutionContext } from '@nestjs/common';
import { OptionalAuthGuard } from './optional-auth.guard';
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

describe('OptionalAuthGuard', () => {
  let guard: OptionalAuthGuard;

  beforeEach(() => {
    jest.resetAllMocks();
    guard = new OptionalAuthGuard(tokens);
  });

  it('allows the request through with no token and no user', () => {
    const req: FakeRequest = { headers: {} };
    expect(guard.canActivate(contextFor(req))).toBe(true);
    expect(req.user).toBeUndefined();
  });

  it('populates req.user when a valid token is provided', () => {
    (tokens.verifyAccessToken as jest.Mock).mockReturnValue({
      sub: 'user-1',
      email: 'a@b.dev',
    });
    const req: FakeRequest = { headers: { authorization: 'Bearer good' } };

    expect(guard.canActivate(contextFor(req))).toBe(true);
    expect(req.user).toMatchObject({ sub: 'user-1' });
  });

  it('allows the request through but leaves user unset for an invalid token', () => {
    (tokens.verifyAccessToken as jest.Mock).mockReturnValue(null);
    const req: FakeRequest = { headers: { authorization: 'Bearer bad' } };

    expect(guard.canActivate(contextFor(req))).toBe(true);
    expect(req.user).toBeUndefined();
  });
});
