import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app';

describe('Comments & Follows (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    agent = request.agent(server);
    await agent
      .post('/auth/register')
      .send({ email: `commenter_${Date.now()}@test.dev`, password: 'secret123' })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires auth to comment', async () => {
    await request(server)
      .post('/samples/popular-1/comments')
      .send({ text: 'nope' })
      .expect(401);
  });

  it('creates a comment, a reply, lists them as a tree and reports ownership', async () => {
    const top = await agent
      .post('/samples/popular-1/comments')
      .send({ text: 'great sample' })
      .expect(201);
    expect(top.body.text).toBe('great sample');
    expect(top.body.isOwner).toBe(true);

    await agent
      .post('/samples/popular-1/comments')
      .send({ text: 'agreed', parentId: top.body.id })
      .expect(201);

    const list = await request(server)
      .get('/samples/popular-1/comments')
      .expect(200);
    const root = list.body.comments.find(
      (c: { id: string }) => c.id === top.body.id,
    );
    expect(root).toBeDefined();
    expect(root.replies.length).toBeGreaterThanOrEqual(1);
    expect(root.replies[0].text).toBe('agreed');
    // Anonymous viewer never owns a comment.
    expect(root.isOwner).toBe(false);
  });

  it('rejects deleting a comment the user does not own', async () => {
    const top = await agent
      .post('/samples/popular-1/comments')
      .send({ text: 'mine to delete' })
      .expect(201);

    const stranger = request.agent(server);
    await stranger
      .post('/auth/register')
      .send({ email: `stranger_${Date.now()}@test.dev`, password: 'secret123' })
      .expect(201);

    await stranger.delete(`/comments/${top.body.id}`).expect(403);
    await agent.delete(`/comments/${top.body.id}`).expect(200);
  });

  it('follows and unfollows a creator and blocks self-follow', async () => {
    // Resolve a real creator id from the seeded southkid profile.
    const profile = await request(server).get('/profiles/southkid').expect(200);
    const creatorId = profile.body.userId;

    await agent.put(`/creators/${creatorId}/follow`).expect(200);
    await agent.delete(`/creators/${creatorId}/follow`).expect(200);

    const me = await agent.get('/auth/me').expect(200);
    await agent.put(`/creators/${me.body.user.sub}/follow`).expect(400);
  });
});
