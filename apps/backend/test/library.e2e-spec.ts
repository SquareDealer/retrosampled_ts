import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { Session, cookieHeader, createTestApp, registerUser } from './e2e-helpers';

const PREFIX = `library-e2e-${Date.now()}`;

describe('Library and comments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let owner: Session;
  let fan: Session;

  let publishedId: string;
  let draftId: string;
  let remakeId: string;
  let otherPublishedId: string;

  async function createSample(
    ownerId: string,
    status: string,
    title: string,
    parentId: string | null = null,
  ): Promise<string> {
    const id = randomUUID();
    await prisma.sample.create({
      data: {
        id,
        ownerId,
        parentId,
        rootId: parentId ?? id,
        depth: parentId ? 1 : 0,
        title,
        status,
        bpm: 90,
        musicalKey: 'Am',
        audioKey: `samples/${id}/audio.wav`,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
      },
    });
    return id;
  }

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);

    owner = await registerUser(server, `${PREFIX}-owner@example.com`, `${PREFIX.slice(-6)}owner`);
    fan = await registerUser(server, `${PREFIX}-fan@example.com`, `${PREFIX.slice(-6)}fan`);

    publishedId = await createSample(owner.id, 'PUBLISHED', 'Dusty Loop');
    draftId = await createSample(owner.id, 'DRAFT', 'Half Done');
    otherPublishedId = await createSample(fan.id, 'PUBLISHED', 'Fan Beat');
    remakeId = await createSample(fan.id, 'PUBLISHED', 'Dusty Flip', publishedId);

    await prisma.like.create({ data: { userId: fan.id, sampleId: publishedId } });
    await prisma.like.create({ data: { userId: fan.id, sampleId: draftId } });
    await prisma.download.create({ data: { userId: fan.id, sampleId: publishedId } });
  });

  afterAll(async () => {
    await prisma.sample.deleteMany({ where: { ownerId: { in: [owner.id, fan.id] } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await app.close();
  });

  describe('library', () => {
    it('requires auth', async () => {
      await request(server).get('/library/items').expect(401);
      await request(server).get('/library/continue-working').expect(401);
    });

    it('rejects the removed type filter and unknown sorts with 400', async () => {
      await request(server)
        .get('/library/items?tab=downloaded&type=free')
        .set('Cookie', cookieHeader(fan.cookies))
        .expect(400);
      await request(server)
        .get('/library/items?tab=liked&sort=most-played')
        .set('Cookie', cookieHeader(fan.cookies))
        .expect(400);
    });

    it('liked tab hides samples the user cannot see', async () => {
      const response = await request(server)
        .get('/library/items?tab=liked')
        .set('Cookie', cookieHeader(fan.cookies))
        .expect(200);

      expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([publishedId]);
      expect(response.body.items[0]).toMatchObject({
        type: 'sample',
        title: 'Dusty Loop',
        creator: { username: owner.username },
        userState: { liked: true, downloaded: true, owned: false },
        bpm: 90,
        key: 'Am',
      });
      expect(response.body.items[0].audioPreviewUrl).toMatch(/\/uploads\/samples\//);
      expect(response.body.nextCursor).toBeNull();
    });

    it('uploads / remakes tabs carry status and originalSample', async () => {
      const uploads = await request(server)
        .get('/library/items?tab=uploads')
        .set('Cookie', cookieHeader(owner.cookies))
        .expect(200);
      expect(uploads.body.items.map((item: { status: string }) => item.status).sort()).toEqual([
        'draft',
        'published',
      ]);

      const drafts = await request(server)
        .get('/library/items?tab=uploads&status=draft')
        .set('Cookie', cookieHeader(owner.cookies))
        .expect(200);
      expect(drafts.body.items.map((item: { id: string }) => item.id)).toEqual([draftId]);

      const remakes = await request(server)
        .get('/library/items?tab=remakes&search=dusty')
        .set('Cookie', cookieHeader(fan.cookies))
        .expect(200);
      expect(remakes.body.items).toHaveLength(1);
      expect(remakes.body.items[0]).toMatchObject({
        id: remakeId,
        type: 'remake',
        status: 'published',
        originalSample: { id: publishedId, title: 'Dusty Loop', creatorUsername: owner.username },
      });
    });

    it('continue-working lists drafts and last opened samples', async () => {
      const response = await request(server)
        .get('/library/continue-working')
        .set('Cookie', cookieHeader(owner.cookies))
        .expect(200);

      expect(response.body.items).toEqual([
        { id: `draft-${draftId}`, label: 'Draft upload', title: 'Half Done', href: `/sample/${draftId}/edit` },
      ]);
    });
  });

  describe('comments', () => {
    let threadId: string;
    let replyId: string;

    it('guests can read, cannot write', async () => {
      const list = await request(server).get(`/samples/${publishedId}/comments`).expect(200);
      expect(list.body).toEqual({ totalCount: 0, comments: [], nextCursor: null });

      await request(server).post(`/samples/${publishedId}/comments`).send({ text: 'x' }).expect(401);
      await request(server).get(`/samples/${draftId}/comments`).expect(404);
    });

    it('creates a thread and a reply, notifies, and rejects deeper nesting', async () => {
      const thread = await request(server)
        .post(`/samples/${publishedId}/comments`)
        .set('Cookie', cookieHeader(fan.cookies))
        .send({ text: 'Filthy chop.' })
        .expect(201);
      threadId = thread.body.id;
      expect(thread.body).toMatchObject({
        text: 'Filthy chop.',
        isOwner: true,
        replies: [],
        user: { id: fan.id, username: fan.username },
      });

      const reply = await request(server)
        .post(`/samples/${publishedId}/comments`)
        .set('Cookie', cookieHeader(owner.cookies))
        .send({ text: 'Thanks!', parentId: threadId })
        .expect(201);
      replyId = reply.body.id;
      expect(reply.body.parentId).toBe(threadId);

      await request(server)
        .post(`/samples/${publishedId}/comments`)
        .set('Cookie', cookieHeader(fan.cookies))
        .send({ text: 'too deep', parentId: replyId })
        .expect(400);

      await request(server)
        .post(`/samples/${publishedId}/comments`)
        .set('Cookie', cookieHeader(fan.cookies))
        .send({ text: 'x'.repeat(501) })
        .expect(400);

      const sample = await prisma.sample.findUnique({ where: { id: publishedId } });
      expect(sample?.commentsCount).toBe(2);

      const ownerNotifications = await request(server)
        .get('/notifications')
        .set('Cookie', cookieHeader(owner.cookies))
        .expect(200);
      expect(ownerNotifications.body.items[0]).toMatchObject({
        type: 'COMMENT',
        href: `/sample/${publishedId}`,
        sample: { id: publishedId, title: 'Dusty Loop' },
        commentId: threadId,
      });

      const fanNotifications = await request(server)
        .get('/notifications')
        .set('Cookie', cookieHeader(fan.cookies))
        .expect(200);
      expect(fanNotifications.body.items[0]).toMatchObject({ type: 'COMMENT_REPLY', commentId: replyId });
    });

    it('lists threads with nested replies and per-viewer isOwner', async () => {
      const list = await request(server)
        .get(`/samples/${publishedId}/comments?sort=oldest`)
        .set('Cookie', cookieHeader(owner.cookies))
        .expect(200);

      expect(list.body.totalCount).toBe(2);
      expect(list.body.comments).toHaveLength(1);
      expect(list.body.comments[0].isOwner).toBe(false);
      expect(list.body.comments[0].replies[0]).toMatchObject({ id: replyId, isOwner: true });
    });

    it('edit is author-only; delete is author, sample owner or admin', async () => {
      await request(server)
        .patch(`/comments/${threadId}`)
        .set('Cookie', cookieHeader(owner.cookies))
        .send({ text: 'hijack' })
        .expect(403);

      const edited = await request(server)
        .patch(`/comments/${threadId}`)
        .set('Cookie', cookieHeader(fan.cookies))
        .send({ text: 'Filthy chop (edited).' })
        .expect(200);
      expect(edited.body.text).toBe('Filthy chop (edited).');

      // The sample owner may delete the fan's thread; replies go with it.
      await request(server)
        .delete(`/comments/${threadId}`)
        .set('Cookie', cookieHeader(owner.cookies))
        .expect(204);

      const list = await request(server).get(`/samples/${publishedId}/comments`).expect(200);
      expect(list.body).toEqual({ totalCount: 0, comments: [], nextCursor: null });

      await request(server)
        .patch(`/comments/${threadId}`)
        .set('Cookie', cookieHeader(fan.cookies))
        .send({ text: 'gone' })
        .expect(404);

      const sample = await prisma.sample.findUnique({ where: { id: publishedId } });
      expect(sample?.commentsCount).toBe(0);
    });

    it('other users cannot comment on a draft', async () => {
      await request(server)
        .post(`/samples/${draftId}/comments`)
        .set('Cookie', cookieHeader(fan.cookies))
        .send({ text: 'x' })
        .expect(404);

      await request(server)
        .post(`/samples/${otherPublishedId}/comments`)
        .set('Cookie', cookieHeader(owner.cookies))
        .send({ text: 'nice' })
        .expect(201);
    });
  });
});
