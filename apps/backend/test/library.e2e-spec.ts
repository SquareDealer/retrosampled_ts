import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app';

describe('Library (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    // The seed creates this demo account with library content.
    agent = request.agent(server);
    await agent
      .post('/auth/login')
      .send({ email: 'you@retrosamples.dev', password: 'password123' })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication', async () => {
    await request(server).get('/library/items?tab=liked').expect(401);
  });

  it('returns liked items flagged as liked', async () => {
    const res = await agent.get('/library/items?tab=liked').expect(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((i: { userState: { liked: boolean } }) => i.userState.liked)).toBe(true);
  });

  it('returns uploads with a status and owned flag', async () => {
    const res = await agent.get('/library/items?tab=uploads').expect(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.type).toBe('sample');
      expect(item.status).toBeDefined();
      expect(item.userState.owned).toBe(true);
    }
  });

  it('filters uploads by status', async () => {
    const res = await agent
      .get('/library/items?tab=uploads&status=draft')
      .expect(200);
    expect(res.body.items.every((i: { status: string }) => i.status === 'draft')).toBe(true);
  });

  it('returns remakes with their original sample', async () => {
    const res = await agent.get('/library/items?tab=remakes').expect(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.type).toBe('remake');
      expect(item.originalSample).toBeDefined();
      expect(item.originalSample.id).toBeTruthy();
    }
  });

  it('scopes search to the active tab', async () => {
    const res = await agent
      .get('/library/items?tab=uploads&search=piano')
      .expect(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].title.toLowerCase()).toContain('piano');
  });

  it('returns continue-working items', async () => {
    const res = await agent.get('/library/continue-working').expect(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeLessThanOrEqual(3);
  });
});
