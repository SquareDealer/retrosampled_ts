import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

type Cookies = Record<string, string>;

function setCookieHeaders(response: request.Response): string[] {
  const raw = response.headers['set-cookie'] as unknown;

  if (Array.isArray(raw)) {
    return raw as string[];
  }

  return typeof raw === 'string' ? [raw] : [];
}

function parseCookies(response: request.Response): Cookies {
  const cookies: Cookies = {};

  for (const cookie of setCookieHeaders(response)) {
    const pair = cookie.split(';')[0];
    const index = pair.indexOf('=');
    cookies[pair.slice(0, index)] = pair.slice(index + 1);
  }

  return cookies;
}

function cookieHeader(cookies: Cookies): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: ReturnType<INestApplication['getHttpServer']>;

  const email = `e2e-${Date.now()}@example.com`;
  const password = 'secret123';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e-' } } });
    await app.close();
  });

  it('keeps GET / public', async () => {
    await request(server).get('/').expect(200).expect('Hello World!');
  });

  it('rejects an unauthenticated GET /auth/me', async () => {
    await request(server).get('/auth/me').expect(401);
  });

  it('runs the full session lifecycle', async () => {
    // --- register -----------------------------------------------------------
    const registered = await request(server)
      .post('/auth/register')
      .send({ email, password })
      .expect(201);

    expect(registered.body.message).toBe('Registered and logged in');
    expect(registered.body.user).toMatchObject({ email, role: 'USER' });
    expect(typeof registered.body.user.username).toBe('string');

    const registerCookies = parseCookies(registered);
    expect(registerCookies.access_token).toBeTruthy();
    expect(registerCookies.refresh_token).toBeTruthy();

    const username = registered.body.user.username as string;

    // --- /auth/me -----------------------------------------------------------
    const me = await request(server)
      .get('/auth/me')
      .set('Cookie', cookieHeader(registerCookies))
      .expect(200);

    expect(me.body.user).toMatchObject({
      id: registered.body.user.id,
      sub: registered.body.user.id,
      email,
      username,
      role: 'USER',
    });

    // the Bearer header works too
    await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${registerCookies.access_token}`)
      .expect(200);

    // --- refresh rotates ----------------------------------------------------
    const refreshed = await request(server)
      .post('/auth/refresh')
      .set('Cookie', cookieHeader(registerCookies))
      .expect(200);

    expect(refreshed.body.message).toBe('Session refreshed');
    expect(refreshed.body.expiresIn).toBeGreaterThan(0);

    const refreshedCookies = parseCookies(refreshed);
    expect(refreshedCookies.refresh_token).toBeTruthy();
    expect(refreshedCookies.refresh_token).not.toBe(registerCookies.refresh_token);

    await request(server)
      .get('/auth/me')
      .set('Cookie', cookieHeader(refreshedCookies))
      .expect(200);

    // --- reusing the rotated token kills the family -------------------------
    await request(server)
      .post('/auth/refresh')
      .set('Cookie', cookieHeader(registerCookies))
      .expect(401);

    await request(server)
      .post('/auth/refresh')
      .set('Cookie', cookieHeader(refreshedCookies))
      .expect(401);

    // --- login again --------------------------------------------------------
    const loggedIn = await request(server)
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    expect(loggedIn.body.message).toBe('Logged in');
    expect(loggedIn.body.user).toMatchObject({ email, username, role: 'USER' });
    expect(loggedIn.body.expiresIn).toBeGreaterThan(0);

    const loginCookies = parseCookies(loggedIn);

    // --- public profile lookup ---------------------------------------------
    const publicUser = await request(server).get(`/users/${username}`).expect(200);
    expect(publicUser.body).toMatchObject({ username, isFollowing: false, isMe: false });

    const selfView = await request(server)
      .get(`/users/${username}`)
      .set('Cookie', cookieHeader(loginCookies))
      .expect(200);
    expect(selfView.body.isMe).toBe(true);

    // --- logout clears the cookies and revokes the family --------------------
    const loggedOut = await request(server)
      .post('/auth/logout')
      .set('Cookie', cookieHeader(loginCookies))
      .expect(200);

    expect(loggedOut.body).toEqual({ message: 'Logged out' });
    const cleared = loggedOut.headers['set-cookie'] as unknown as string[];
    expect(cleared.join(';')).toContain('access_token=;');
    expect(cleared.join(';')).toContain('refresh_token=;');

    await request(server)
      .post('/auth/refresh')
      .set('Cookie', cookieHeader(loginCookies))
      .expect(401);
  });

  it('rejects invalid credentials and duplicate registrations', async () => {
    await request(server)
      .post('/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);

    await request(server)
      .post('/auth/register')
      .send({ email, password })
      .expect(409);

    await request(server)
      .post('/auth/register')
      .send({ email: 'not-an-email', password })
      .expect(400);
  });

  it('changes the password and keeps the current session alive', async () => {
    const changeEmail = `e2e-change-${Date.now()}@example.com`;

    const registered = await request(server)
      .post('/auth/register')
      .send({ email: changeEmail, password })
      .expect(201);

    const cookies = parseCookies(registered);

    await request(server)
      .post('/auth/change-password')
      .set('Cookie', cookieHeader(cookies))
      .send({ oldPassword: password, newPassword: 'another-secret' })
      .expect(200);

    await request(server)
      .post('/auth/login')
      .send({ email: changeEmail, password })
      .expect(401);

    await request(server)
      .post('/auth/login')
      .send({ email: changeEmail, password: 'another-secret' })
      .expect(200);

    // the session that changed the password still refreshes
    await request(server)
      .post('/auth/refresh')
      .set('Cookie', cookieHeader(cookies))
      .expect(200);
  });

  it('soft deletes the account', async () => {
    const deleteEmail = `e2e-delete-${Date.now()}@example.com`;

    const registered = await request(server)
      .post('/auth/register')
      .send({ email: deleteEmail, password })
      .expect(201);

    const cookies = parseCookies(registered);

    await request(server)
      .delete('/auth/account')
      .set('Cookie', cookieHeader(cookies))
      .send({ password })
      .expect(200);

    const stored = await prisma.user.findUnique({ where: { email: deleteEmail } });
    expect(stored?.isActive).toBe(false);

    await request(server)
      .post('/auth/login')
      .send({ email: deleteEmail, password })
      .expect(401);
  });
});
