import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app';

describe('Samples (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns a feed of published samples', async () => {
    const res = await request(server).get('/samples?limit=5').expect(200);
    expect(Array.isArray(res.body.samples)).toBe(true);
    expect(res.body.samples.length).toBeGreaterThan(0);
    const sample = res.body.samples[0];
    expect(sample).toHaveProperty('id');
    expect(sample).toHaveProperty('author');
    expect(sample).toHaveProperty('likesCount');
    expect(sample).toHaveProperty('remakesCount');
  });

  it('paginates with an opaque cursor', async () => {
    const page1 = await request(server)
      .get('/samples?sort=popular&limit=2')
      .expect(200);
    expect(page1.body.samples).toHaveLength(2);
    expect(page1.body.nextCursor).toBeTruthy();

    const page2 = await request(server)
      .get(`/samples?sort=popular&limit=2&cursor=${page1.body.nextCursor}`)
      .expect(200);
    const ids1 = page1.body.samples.map((s: { id: string }) => s.id);
    const ids2 = page2.body.samples.map((s: { id: string }) => s.id);
    expect(ids2.every((id: string) => !ids1.includes(id))).toBe(true);
  });

  it('filters by access type', async () => {
    const res = await request(server).get('/samples?type=premium&limit=20').expect(200);
    const ids = res.body.samples.map((s: { id: string }) => s.id);
    expect(ids).toContain('premium-1');
  });

  it('returns a detail with sampling lineage and creator roles', async () => {
    const res = await request(server).get('/samples/popular-4').expect(200);
    expect(res.body.id).toBe('popular-4');
    expect(res.body.inheritedFrom).toEqual({ id: 'popular-3', title: expect.any(String) });
    expect(res.body.relatedSamples.rootOriginal.id).toBe('popular-1');

    const roles = res.body.creators.flatMap((c: { roles: string[] }) => c.roles);
    expect(roles).toContain('OG_CREATOR');
    expect(roles).toContain('CURRENT_CREATOR');
  });

  it('returns 404 for an unknown sample', async () => {
    await request(server).get('/samples/does-not-exist').expect(404);
  });

  it('persists a like for an authenticated user and clears it again', async () => {
    const agent = request.agent(server);
    await agent
      .post('/auth/register')
      .send({ email: `liker_${Date.now()}@test.dev`, password: 'secret123' })
      .expect(201);

    await agent.put('/samples/popular-1/like').expect(200);
    const liked = await agent.get('/samples/popular-1').expect(200);
    expect(liked.body.isLiked).toBe(true);

    await agent.delete('/samples/popular-1/like').expect(200);
    const unliked = await agent.get('/samples/popular-1').expect(200);
    expect(unliked.body.isLiked).toBe(false);
  });

  it('requires auth to like a sample', async () => {
    await request(server).put('/samples/popular-1/like').expect(401);
  });
});
