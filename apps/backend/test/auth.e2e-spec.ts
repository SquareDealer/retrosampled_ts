import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;

  // Unique email so the suite is re-runnable against a persistent database.
  const email = `e2e_${Date.now()}@test.dev`;
  const password = 'secret123';

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a new user and sets session cookies', async () => {
    const res = await request(server)
      .post('/auth/register')
      .send({ email, password })
      .expect(201);

    expect(res.body.user.email).toBe(email);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('access_token='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refresh_token='))).toBe(true);
  });

  it('rejects a duplicate registration', async () => {
    await request(server)
      .post('/auth/register')
      .send({ email, password })
      .expect(400);
  });

  it('rejects an invalid email at the validation layer', async () => {
    await request(server)
      .post('/auth/register')
      .send({ email: 'not-an-email', password })
      .expect(400);
  });

  it('logs in, reads /auth/me, refreshes and logs out via cookies', async () => {
    const agent = request.agent(server);

    const login = await agent
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    expect(login.body.user.email).toBe(email);

    const me = await agent.get('/auth/me').expect(200);
    expect(me.body.user.email).toBe(email);
    expect(me.body.user.sub).toBeDefined();

    await agent.post('/auth/refresh').expect(201);

    // Still authenticated after rotation.
    await agent.get('/auth/me').expect(200);

    await agent.post('/auth/logout').expect(201);
  });

  it('rejects a wrong password', async () => {
    await request(server)
      .post('/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
  });

  it('blocks /auth/me without a token', async () => {
    await request(server).get('/auth/me').expect(401);
  });
});
