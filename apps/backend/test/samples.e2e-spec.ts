import { resolve } from 'path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { encodePcm16Wav } from '../src/uploads/service/wav-reader';

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

/** 0.5 s mono 8 kHz sine — small, but a real decodable WAV. */
function wavFixture(): Buffer {
  const frames = 4000;
  const mono = new Array(frames).fill(0).map((_, i) => Math.sin(i / 6) * 0.8);
  return encodePcm16Wav([mono], 8000);
}

const PREFIX = `samples-e2e-${Date.now()}`;
const PASSWORD = 'secret123';

describe('Samples (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let server: ReturnType<INestApplication['getHttpServer']>;

  let ownerCookies: Cookies;
  let otherCookies: Cookies;
  let ownerId: string;
  let otherId: string;

  let sampleId: string;
  let remakeId: string;

  async function register(local: string): Promise<{ id: string; cookies: Cookies }> {
    const response = await request(server)
      .post('/auth/register')
      .send({ email: `${PREFIX}-${local}@example.com`, password: PASSWORD, username: `${local}${Date.now() % 100000}` })
      .expect(201);

    return { id: response.body.user.id as string, cookies: parseCookies(response) };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    // Mirrors main.ts so the download URL of the local driver can be fetched.
    app.useStaticAssets(resolve(process.env.LOCAL_STORAGE_DIR ?? './uploads'), {
      prefix: '/uploads/',
    });

    await app.init();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);

    const owner = await register('owner');
    ownerId = owner.id;
    ownerCookies = owner.cookies;

    const other = await register('other');
    otherId = other.id;
    otherCookies = other.cookies;
  });

  afterAll(async () => {
    // Deleting through the API removes the storage objects as well.
    for (const id of [remakeId, sampleId]) {
      if (id) {
        await request(server).delete(`/samples/${id}`).set('Cookie', cookieHeader(ownerCookies));
      }
    }
    await prisma.sample.deleteMany({ where: { ownerId: { in: [ownerId, otherId] } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await app.close();
  });

  it('rejects a guest upload with 401', async () => {
    await request(server)
      .post('/samples')
      .attach('audio', wavFixture(), 'guest.wav')
      .expect(401);
  });

  it('rejects an unsupported file type with 400', async () => {
    await request(server)
      .post('/samples')
      .set('Cookie', cookieHeader(ownerCookies))
      .attach('audio', Buffer.from('nope'), { filename: 'bounce.m4a', contentType: 'audio/mp4' })
      .expect(400);
  });

  it('uploads a WAV as multipart and processes it into a DRAFT with peaks', async () => {
    const response = await request(server)
      .post('/samples')
      .set('Cookie', cookieHeader(ownerCookies))
      .field('title', 'E2E Drum Break')
      .field('tags', 'drums,break')
      .field('tags', 'Vinyl')
      .field('bpm', '94')
      .field('musicalKey', 'F#m')
      .field('sampleType', 'loop')
      .attach('audio', wavFixture(), { filename: 'drum_break_94.wav', contentType: 'audio/wav' })
      .expect(201);

    const sample = response.body.sample;
    sampleId = sample.id;

    expect(['PROCESSING', 'DRAFT']).toContain(sample.status);
    expect(sample.status).toBe('DRAFT');
    expect(sample.title).toBe('E2E Drum Break');
    expect(sample.tags).toEqual(['drums', 'break', 'vinyl']);
    expect(sample.bpm).toBe(94);
    expect(sample.musicalKey).toBe('F#m');
    expect(sample.duration).toBeCloseTo(0.5, 2);
    expect(sample.audioPreviewUrl).toMatch(/\/uploads\/samples\/.+\/audio\.wav$/);
    expect(sample.waveformPeaksUrl).toMatch(/\/uploads\/samples\/.+\/peaks\.json$/);
    expect(sample.creators).toEqual([
      expect.objectContaining({ id: ownerId, roles: ['OG_CREATOR', 'CURRENT_CREATOR'] }),
    ]);

    // Peaks JSON is served and has the WaveformFromJsonForSample shape.
    const peaks = await request(server)
      .get(new URL(sample.waveformPeaksUrl).pathname)
      .expect(200);
    expect(peaks.body).toMatchObject({ version: 2, channels: 1, bits: 8, length: 800 });
    expect(peaks.body.data).toHaveLength(1600);
  });

  it('hides the draft from other users and guests (404) but not from the owner', async () => {
    await request(server).get(`/samples/${sampleId}`).expect(404);
    await request(server)
      .get(`/samples/${sampleId}`)
      .set('Cookie', cookieHeader(otherCookies))
      .expect(404);
    await request(server)
      .get(`/samples/${sampleId}`)
      .set('Cookie', cookieHeader(ownerCookies))
      .expect(200);

    // Nor does the draft show up in the public feed.
    const feed = await request(server).get('/samples?limit=50').expect(200);
    expect(feed.body.samples.map((s: { id: string }) => s.id)).not.toContain(sampleId);
  });

  it('refuses to publish while required metadata is missing (422)', async () => {
    await request(server)
      .patch(`/samples/${sampleId}`)
      .set('Cookie', cookieHeader(ownerCookies))
      .send({ bpm: null })
      .expect(200);

    const response = await request(server)
      .patch(`/samples/${sampleId}/visibility`)
      .set('Cookie', cookieHeader(ownerCookies))
      .send({ status: 'published' })
      .expect(422);

    expect(response.body.message).toEqual(['BPM is required']);

    await request(server)
      .patch(`/samples/${sampleId}`)
      .set('Cookie', cookieHeader(ownerCookies))
      .send({ bpm: 94, description: 'chopped from a 7 inch' })
      .expect(200);
  });

  it('publishes and appears in GET /samples with the feed shape', async () => {
    const response = await request(server)
      .patch(`/samples/${sampleId}/visibility`)
      .set('Cookie', cookieHeader(ownerCookies))
      .send({ status: 'published' })
      .expect(200);

    expect(response.body.sample.status).toBe('PUBLISHED');
    expect(response.body.sample.publishedAt).toBeTruthy();

    const feed = await request(server).get('/samples?limit=50&search=E2E Drum').expect(200);
    const row = feed.body.samples.find((s: { id: string }) => s.id === sampleId);

    expect(row).toMatchObject({
      id: sampleId,
      title: 'E2E Drum Break',
      author: expect.stringMatching(/^@owner/),
      authorId: ownerId,
      tags: ['drums', 'break', 'vinyl'],
      bpm: 94,
      key: 'F#m',
      time: '0:00',
      likesCount: 0,
      isLiked: false,
      remakesCount: 0,
    });

    // Tag and bpm filters find it; a foreign key does not.
    const byTag = await request(server).get('/samples?tags=vinyl&bpm_min=90&bpm_max=100').expect(200);
    expect(byTag.body.samples.map((s: { id: string }) => s.id)).toContain(sampleId);
    const byKey = await request(server).get('/samples?key=Cm').expect(200);
    expect(byKey.body.samples.map((s: { id: string }) => s.id)).not.toContain(sampleId);

    // Owner counters count published roots only.
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: ownerId } });
    expect(owner.uploadsCount).toBe(1);
    expect(owner.remakesCount).toBe(0);
  });

  it('likes and unlikes idempotently with correct counts', async () => {
    const other = cookieHeader(otherCookies);

    await request(server).put(`/samples/${sampleId}/like`).expect(401);

    let response = await request(server).put(`/samples/${sampleId}/like`).set('Cookie', other).expect(200);
    expect(response.body).toEqual({ liked: true, likesCount: 1 });

    response = await request(server).put(`/samples/${sampleId}/like`).set('Cookie', other).expect(200);
    expect(response.body).toEqual({ liked: true, likesCount: 1 });

    const detail = await request(server).get(`/samples/${sampleId}`).set('Cookie', other).expect(200);
    expect(detail.body.isLiked).toBe(true);
    expect(detail.body.likesCount).toBe(1);

    const liked = await request(server).get('/samples?sort=liked').set('Cookie', other).expect(200);
    expect(liked.body.samples.map((s: { id: string }) => s.id)).toContain(sampleId);
    await request(server).get('/samples?sort=liked').expect(401);

    response = await request(server).delete(`/samples/${sampleId}/like`).set('Cookie', other).expect(200);
    expect(response.body).toEqual({ liked: false, likesCount: 0 });

    response = await request(server).delete(`/samples/${sampleId}/like`).set('Cookie', other).expect(200);
    expect(response.body).toEqual({ liked: false, likesCount: 0 });
  });

  it('creates a remake that inherits tags and sets parentId/rootId; roles show on both pages', async () => {
    const created = await request(server)
      .post('/samples')
      .set('Cookie', cookieHeader(otherCookies))
      .field('title', 'E2E Drum Break (tape flip)')
      .field('parentId', sampleId)
      .attach('audio', wavFixture(), { filename: 'tape_flip.wav', contentType: 'audio/wav' })
      .expect(201);

    remakeId = created.body.sample.id;
    expect(created.body.sample.parentId).toBe(sampleId);
    expect(created.body.sample.rootId).toBe(sampleId);
    expect(created.body.sample.tags).toEqual(['drums', 'break', 'vinyl']);
    expect(created.body.sample.inheritedFrom).toEqual({ id: sampleId, title: 'E2E Drum Break' });

    const row = await prisma.sample.findUniqueOrThrow({ where: { id: remakeId } });
    expect(row.depth).toBe(1);

    await request(server)
      .patch(`/samples/${remakeId}/visibility`)
      .set('Cookie', cookieHeader(otherCookies))
      .send({ status: 'published' })
      .expect(200);

    const remake = await request(server).get(`/samples/${remakeId}`).expect(200);
    expect(remake.body.creators).toEqual([
      expect.objectContaining({ id: ownerId, roles: ['OG_CREATOR'] }),
      expect.objectContaining({ id: otherId, roles: ['CURRENT_CREATOR'] }),
    ]);
    expect(remake.body.relatedSamples.rootOriginal.id).toBe(sampleId);
    expect(remake.body.relatedSamples.inheritedOriginal).toBeUndefined();

    const parent = await request(server).get(`/samples/${sampleId}`).expect(200);
    expect(parent.body.remakesCount).toBe(1);
    expect(parent.body.relatedSamples.remakes.map((s: { id: string }) => s.id)).toEqual([remakeId]);

    // The parent owner was notified of the remake.
    const notification = await prisma.notification.findFirst({
      where: { userId: ownerId, type: 'REMAKE', sampleId: remakeId },
    });
    expect(notification).not.toBeNull();

    // Profile tabs contract used by Task 3.2.
    const otherUser = await prisma.user.findUniqueOrThrow({ where: { id: otherId } });
    const remakesTab = await request(server)
      .get(`/samples?author=${otherUser.username}&tab=remakes`)
      .expect(200);
    expect(remakesTab.body.samples.map((s: { id: string }) => s.id)).toEqual([remakeId]);
    const uploadsTab = await request(server)
      .get(`/samples?author=${otherUser.username}&tab=uploads`)
      .expect(200);
    expect(uploadsTab.body.samples).toEqual([]);
  });

  it('forbids editing someone else\'s sample (403) and 404s a stranger on a private one', async () => {
    await request(server)
      .patch(`/samples/${sampleId}`)
      .set('Cookie', cookieHeader(otherCookies))
      .send({ title: 'hijack' })
      .expect(403);

    await request(server)
      .patch(`/samples/${sampleId}/visibility`)
      .set('Cookie', cookieHeader(ownerCookies))
      .send({ status: 'private' })
      .expect(200);

    await request(server).get(`/samples/${sampleId}`).expect(404);
    await request(server)
      .patch(`/samples/${sampleId}`)
      .set('Cookie', cookieHeader(otherCookies))
      .send({ title: 'hijack' })
      .expect(404);

    await request(server)
      .patch(`/samples/${sampleId}/visibility`)
      .set('Cookie', cookieHeader(ownerCookies))
      .send({ status: 'published' })
      .expect(200);
  });

  it('download returns a URL that serves the file and counts the download', async () => {
    await request(server).post(`/samples/${sampleId}/downloads`).expect(401);

    const response = await request(server)
      .post(`/samples/${sampleId}/downloads`)
      .set('Cookie', cookieHeader(otherCookies))
      .expect(200);

    expect(response.body.downloadsCount).toBe(1);
    expect(new Date(response.body.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const file = await request(server).get(new URL(response.body.downloadUrl).pathname).expect(200);
    expect(file.headers['content-type']).toMatch(/audio\/(x-)?wav/);
    expect(Buffer.from(file.body).length).toBeGreaterThan(44);
  });

  it('counts plays once per window and 404s hidden samples', async () => {
    await request(server).post(`/samples/${sampleId}/plays`).expect(204);
    await request(server).post(`/samples/${sampleId}/plays`).expect(204);
    await request(server).post(`/samples/does-not-exist/plays`).expect(404);

    const row = await prisma.sample.findUniqueOrThrow({ where: { id: sampleId } });
    expect(row.playsCount).toBe(1);
  });

  it('POST /samples/:id/remakes creates an empty DRAFT child and retry is refused unless FAILED', async () => {
    const created = await request(server)
      .post(`/samples/${sampleId}/remakes`)
      .set('Cookie', cookieHeader(otherCookies))
      .send({})
      .expect(201);

    const draft = created.body.sample;
    expect(draft.status).toBe('DRAFT');
    expect(draft.parentId).toBe(sampleId);
    expect(draft.title).toBe('E2E Drum Break (remake)');
    expect(draft.audioPreviewUrl).toBe('');

    await request(server)
      .post(`/samples/${draft.id}/retry-processing`)
      .set('Cookie', cookieHeader(otherCookies))
      .expect(409);

    await request(server)
      .delete(`/samples/${draft.id}`)
      .set('Cookie', cookieHeader(otherCookies))
      .expect(204);
  });

  it('deleting the parent detaches the remake and removes storage objects', async () => {
    const before = await prisma.sample.findUniqueOrThrow({ where: { id: sampleId } });
    const audioPath = new URL(
      `http://localhost/uploads/${before.audioKey}`,
    ).pathname;
    await request(server).get(audioPath).expect(200);

    await request(server)
      .delete(`/samples/${sampleId}`)
      .set('Cookie', cookieHeader(otherCookies))
      .expect(403);

    await request(server)
      .delete(`/samples/${sampleId}`)
      .set('Cookie', cookieHeader(ownerCookies))
      .expect(204);

    await request(server).get(`/samples/${sampleId}`).expect(404);
    await request(server).get(audioPath).expect(404);

    const remake = await prisma.sample.findUniqueOrThrow({ where: { id: remakeId } });
    expect(remake.parentId).toBeNull();
    expect(remake.rootId).toBe(remakeId);
    expect(remake.depth).toBe(0);

    const detail = await request(server).get(`/samples/${remakeId}`).expect(200);
    expect(detail.body.inheritedFrom).toBeUndefined();
    expect(detail.body.creators[0].roles).toEqual(['OG_CREATOR', 'CURRENT_CREATOR']);
    sampleId = '';
  });
});
