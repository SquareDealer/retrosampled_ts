import { randomUUID } from 'crypto';
import {
  ForbiddenException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { SampleAccessService } from '../src/samples/service/sample-access.service';

type Cookies = Record<string, string>;

function parseCookies(response: request.Response): Cookies {
  const raw = response.headers['set-cookie'] as unknown;
  const list = Array.isArray(raw) ? (raw as string[]) : typeof raw === 'string' ? [raw] : [];
  const cookies: Cookies = {};

  for (const cookie of list) {
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

const PREFIX = `admin-e2e-${Date.now()}`;
const PASSWORD = 'secret123';

describe('Admin (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sampleAccess: SampleAccessService;
  let server: ReturnType<INestApplication['getHttpServer']>;

  let adminCookies: Cookies;
  let userCookies: Cookies;
  let adminId: string;
  let userId: string;
  let victimId: string;

  async function register(local: string): Promise<{ id: string; cookies: Cookies }> {
    const response = await request(server)
      .post('/auth/register')
      .send({ email: `${PREFIX}-${local}@example.com`, password: PASSWORD })
      .expect(201);

    return { id: response.body.user.id as string, cookies: parseCookies(response) };
  }

  async function login(local: string): Promise<Cookies> {
    const response = await request(server)
      .post('/auth/login')
      .send({ email: `${PREFIX}-${local}@example.com`, password: PASSWORD })
      .expect(200);

    return parseCookies(response);
  }

  async function createSample(
    ownerId: string,
    status = 'PUBLISHED',
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
        title: `sample ${id.slice(0, 8)}`,
        status,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
      },
    });

    return id;
  }

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
    sampleAccess = app.get(SampleAccessService);

    const admin = await register('admin');
    adminId = admin.id;
    // Registration always creates a USER; promote, then log in again so the
    // access token actually carries role=ADMIN.
    await prisma.user.update({ where: { id: adminId }, data: { role: 'ADMIN' } });
    adminCookies = await login('admin');

    const user = await register('user');
    userId = user.id;
    userCookies = user.cookies;

    const victim = await register('victim');
    victimId = victim.id;
  });

  afterAll(async () => {
    await prisma.sample.deleteMany({ where: { ownerId: { in: [adminId, userId, victimId] } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'admin-e2e-' } } });
    await app.close();
  });

  describe('GET /admin/users', () => {
    it('answers 401 to a guest', async () => {
      await request(server).get('/admin/users').expect(401);
    });

    it('answers 403 to a signed-in USER', async () => {
      await request(server)
        .get('/admin/users')
        .set('Cookie', cookieHeader(userCookies))
        .expect(403);
    });

    it('answers 200 to an ADMIN and returns the moderation fields', async () => {
      const response = await request(server)
        .get('/admin/users')
        .set('Cookie', cookieHeader(adminCookies))
        .expect(200);

      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body).toHaveProperty('nextCursor');

      const row = response.body.users.find(
        (candidate: { id: string }) => candidate.id === userId,
      );
      expect(row).toMatchObject({ id: userId, role: 'USER', isActive: true });
      expect(Object.keys(row).sort()).toEqual(
        ['createdAt', 'email', 'id', 'isActive', 'role', 'username'].sort(),
      );
    });

    it('filters with ?q= and paginates with ?limit=&cursor=', async () => {
      const filtered = await request(server)
        .get(`/admin/users?q=${PREFIX}-victim`)
        .set('Cookie', cookieHeader(adminCookies))
        .expect(200);

      expect(filtered.body.users).toHaveLength(1);
      expect(filtered.body.users[0].id).toBe(victimId);

      const firstPage = await request(server)
        .get(`/admin/users?q=${PREFIX}&limit=1`)
        .set('Cookie', cookieHeader(adminCookies))
        .expect(200);

      expect(firstPage.body.users).toHaveLength(1);
      expect(firstPage.body.nextCursor).toBeTruthy();

      const secondPage = await request(server)
        .get(`/admin/users?q=${PREFIX}&limit=1&cursor=${firstPage.body.nextCursor}`)
        .set('Cookie', cookieHeader(adminCookies))
        .expect(200);

      expect(secondPage.body.users).toHaveLength(1);
      expect(secondPage.body.users[0].id).not.toBe(firstPage.body.users[0].id);
    });

    it('rejects an unknown query parameter', async () => {
      await request(server)
        .get('/admin/users?nope=1')
        .set('Cookie', cookieHeader(adminCookies))
        .expect(400);
    });
  });

  describe('PATCH /admin/users/:id', () => {
    it('changes another user`s role', async () => {
      const promoted = await request(server)
        .patch(`/admin/users/${victimId}`)
        .set('Cookie', cookieHeader(adminCookies))
        .send({ role: 'ADMIN' })
        .expect(200);

      expect(promoted.body).toMatchObject({ id: victimId, role: 'ADMIN' });

      const demoted = await request(server)
        .patch(`/admin/users/${victimId}`)
        .set('Cookie', cookieHeader(adminCookies))
        .send({ role: 'USER' })
        .expect(200);

      expect(demoted.body.role).toBe('USER');
    });

    it('deactivates another user and revokes their refresh tokens', async () => {
      await request(server)
        .patch(`/admin/users/${victimId}`)
        .set('Cookie', cookieHeader(adminCookies))
        .send({ isActive: false })
        .expect(200);

      const stored = await prisma.user.findUnique({ where: { id: victimId } });
      expect(stored?.isActive).toBe(false);

      const live = await prisma.refreshToken.count({
        where: { userId: victimId, revokedAt: null },
      });
      expect(live).toBe(0);

      await request(server)
        .patch(`/admin/users/${victimId}`)
        .set('Cookie', cookieHeader(adminCookies))
        .send({ isActive: true })
        .expect(200);
    });

    it('refuses to demote or deactivate yourself', async () => {
      await request(server)
        .patch(`/admin/users/${adminId}`)
        .set('Cookie', cookieHeader(adminCookies))
        .send({ role: 'USER' })
        .expect(400);

      await request(server)
        .patch(`/admin/users/${adminId}`)
        .set('Cookie', cookieHeader(adminCookies))
        .send({ isActive: false })
        .expect(400);

      const stored = await prisma.user.findUnique({ where: { id: adminId } });
      expect(stored).toMatchObject({ role: 'ADMIN', isActive: true });
    });

    it('404s on an unknown user and 400s on a bad role', async () => {
      await request(server)
        .patch('/admin/users/does-not-exist')
        .set('Cookie', cookieHeader(adminCookies))
        .send({ role: 'ADMIN' })
        .expect(404);

      await request(server)
        .patch(`/admin/users/${victimId}`)
        .set('Cookie', cookieHeader(adminCookies))
        .send({ role: 'SUPERUSER' })
        .expect(400);
    });

    it('answers 403 to a USER', async () => {
      await request(server)
        .patch(`/admin/users/${victimId}`)
        .set('Cookie', cookieHeader(userCookies))
        .send({ role: 'ADMIN' })
        .expect(403);
    });
  });

  describe('DELETE /admin/samples/:id', () => {
    it('lets an admin delete someone else`s sample and detaches its remakes', async () => {
      const parent = await createSample(userId);
      const child = await createSample(userId, 'PUBLISHED', parent);

      await request(server)
        .delete(`/admin/samples/${parent}`)
        .set('Cookie', cookieHeader(adminCookies))
        .expect(204);

      expect(await prisma.sample.findUnique({ where: { id: parent } })).toBeNull();
      const orphan = await prisma.sample.findUnique({ where: { id: child } });
      expect(orphan?.parentId).toBeNull();

      await prisma.sample.delete({ where: { id: child } });
    });

    it('answers 403 to a USER, even for their own sample', async () => {
      const sampleId = await createSample(userId);

      await request(server)
        .delete(`/admin/samples/${sampleId}`)
        .set('Cookie', cookieHeader(userCookies))
        .expect(403);

      expect(await prisma.sample.findUnique({ where: { id: sampleId } })).not.toBeNull();
      await prisma.sample.delete({ where: { id: sampleId } });
    });

    it('answers 401 to a guest and 404 for an unknown sample', async () => {
      await request(server).delete('/admin/samples/whatever').expect(401);

      await request(server)
        .delete('/admin/samples/whatever')
        .set('Cookie', cookieHeader(adminCookies))
        .expect(404);
    });
  });

  describe('PATCH /admin/samples/:id/visibility', () => {
    it('hides and republishes a sample', async () => {
      const sampleId = await createSample(userId);

      const hidden = await request(server)
        .patch(`/admin/samples/${sampleId}/visibility`)
        .set('Cookie', cookieHeader(adminCookies))
        .send({ status: 'private' })
        .expect(200);

      expect(hidden.body).toMatchObject({ id: sampleId, status: 'PRIVATE' });

      const shown = await request(server)
        .patch(`/admin/samples/${sampleId}/visibility`)
        .set('Cookie', cookieHeader(adminCookies))
        .send({ status: 'published' })
        .expect(200);

      expect(shown.body.status).toBe('PUBLISHED');
      expect(shown.body.publishedAt).toBeTruthy();

      await request(server)
        .patch(`/admin/samples/${sampleId}/visibility`)
        .set('Cookie', cookieHeader(adminCookies))
        .send({ status: 'deleted' })
        .expect(400);

      await request(server)
        .patch(`/admin/samples/${sampleId}/visibility`)
        .set('Cookie', cookieHeader(userCookies))
        .send({ status: 'private' })
        .expect(403);

      await prisma.sample.delete({ where: { id: sampleId } });
    });
  });

  describe('DELETE /admin/comments/:id', () => {
    it('soft deletes the comment and decrements the counter', async () => {
      const sampleId = await createSample(userId);
      const comment = await prisma.comment.create({
        data: { sampleId, userId, text: 'spam spam spam' },
      });
      await prisma.sample.update({
        where: { id: sampleId },
        data: { commentsCount: 1 },
      });

      await request(server)
        .delete(`/admin/comments/${comment.id}`)
        .set('Cookie', cookieHeader(userCookies))
        .expect(403);

      await request(server)
        .delete(`/admin/comments/${comment.id}`)
        .set('Cookie', cookieHeader(adminCookies))
        .expect(204);

      const stored = await prisma.comment.findUnique({ where: { id: comment.id } });
      expect(stored).not.toBeNull();
      expect(stored?.deletedAt).not.toBeNull();

      const sample = await prisma.sample.findUnique({ where: { id: sampleId } });
      expect(sample?.commentsCount).toBe(0);

      // A soft-deleted comment is gone for good.
      await request(server)
        .delete(`/admin/comments/${comment.id}`)
        .set('Cookie', cookieHeader(adminCookies))
        .expect(404);

      await prisma.sample.delete({ where: { id: sampleId } });
    });
  });

  describe('SampleAccessService (no sample endpoints exist yet)', () => {
    it('hides a draft from everyone but its owner and admins', async () => {
      const draftId = await createSample(userId, 'DRAFT');

      await expect(
        sampleAccess.assertCan(null, 'sample:view', draftId),
      ).rejects.toBeInstanceOf(NotFoundException);

      await expect(
        sampleAccess.assertCan({ id: victimId, role: 'USER' }, 'sample:view', draftId),
      ).rejects.toBeInstanceOf(NotFoundException);

      await expect(
        sampleAccess.assertCan({ id: userId, role: 'USER' }, 'sample:view', draftId),
      ).resolves.toMatchObject({ id: draftId, status: 'DRAFT' });

      await expect(
        sampleAccess.assertCan({ id: adminId, role: 'ADMIN' }, 'sample:view', draftId),
      ).resolves.toMatchObject({ id: draftId });

      await prisma.sample.delete({ where: { id: draftId } });
    });

    it('answers 403 when a visible sample is simply not yours', async () => {
      const sampleId = await createSample(userId);

      await expect(
        sampleAccess.assertCan({ id: victimId, role: 'USER' }, 'sample:edit', sampleId),
      ).rejects.toBeInstanceOf(ForbiddenException);

      await prisma.sample.delete({ where: { id: sampleId } });
    });
  });
});
