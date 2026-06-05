import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app';

describe('Sample upload (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let agent: ReturnType<typeof request.agent>;

  const peaks = JSON.stringify({
    version: 2,
    channels: 1,
    sample_rate: 44100,
    samples_per_pixel: 256,
    bits: 16,
    length: 4,
    data: [0, 1200, -900, 800],
  });

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    agent = request.agent(server);
    await agent
      .post('/auth/register')
      .send({ email: `uploader_${Date.now()}@test.dev`, password: 'secret123' })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication', async () => {
    await request(server)
      .post('/samples')
      .field('title', 'x')
      .field('durationSec', '10')
      .field('peaks', peaks)
      .attach('audio', Buffer.from('RIFFfake'), {
        filename: 'a.wav',
        contentType: 'audio/wav',
      })
      .expect(401);
  });

  it('rejects an upload without an audio file', async () => {
    await agent
      .post('/samples')
      .field('title', 'No file')
      .field('durationSec', '10')
      .field('peaks', peaks)
      .expect(400);
  });

  it('rejects an unsupported audio type', async () => {
    await agent
      .post('/samples')
      .field('title', 'Bad type')
      .field('durationSec', '10')
      .field('peaks', peaks)
      .attach('audio', Buffer.from('not audio'), {
        filename: 'a.txt',
        contentType: 'text/plain',
      })
      .expect(400);
  });

  it('uploads a draft sample, then publishes and edits it', async () => {
    const created = await agent
      .post('/samples')
      .field('title', 'My First Loop')
      .field('tags', 'lofi, test')
      .field('bpm', '90')
      .field('key', 'Am')
      .field('accessType', 'free')
      .field('durationSec', '32')
      .field('peaks', peaks)
      .attach('audio', Buffer.from('RIFF....WAVEfmt '), {
        filename: 'loop.wav',
        contentType: 'audio/wav',
      })
      .expect(201);

    expect(created.body.id).toBeDefined();
    expect(created.body.status).toBe('DRAFT');
    const id = created.body.id;

    // Draft is owned and shows in the uploads tab.
    const uploads = await agent.get('/library/items?tab=uploads').expect(200);
    expect(uploads.body.items.some((i: { id: string }) => i.id === id)).toBe(true);

    // Detail reflects the uploaded metadata and audio/waveform URLs.
    const detail = await agent.get(`/samples/${id}`).expect(200);
    expect(detail.body.title).toBe('My First Loop');
    expect(detail.body.bpm).toBe(90);
    expect(detail.body.audioPreviewUrl).toContain(`/uploads/samples/${id}/audio.wav`);
    expect(detail.body.waveformPeaksUrl).toContain(`/uploads/samples/${id}/peaks.json`);

    // Edit metadata.
    await agent
      .patch(`/samples/${id}`)
      .send({ title: 'Renamed Loop', tags: ['lofi', 'chill'] })
      .expect(200);
    const renamed = await agent.get(`/samples/${id}`).expect(200);
    expect(renamed.body.title).toBe('Renamed Loop');

    // Publish, then it appears in the public feed.
    await agent
      .patch(`/samples/${id}/visibility`)
      .send({ status: 'published' })
      .expect(200);
    const feed = await agent.get('/samples?limit=50').expect(200);
    expect(feed.body.samples.some((s: { id: string }) => s.id === id)).toBe(true);
  });

  it('rejects another user editing the sample', async () => {
    const created = await agent
      .post('/samples')
      .field('title', 'Owned Loop')
      .field('durationSec', '20')
      .field('peaks', peaks)
      .attach('audio', Buffer.from('RIFFdata'), {
        filename: 'b.wav',
        contentType: 'audio/wav',
      })
      .expect(201);

    const stranger = request.agent(server);
    await stranger
      .post('/auth/register')
      .send({ email: `intruder_${Date.now()}@test.dev`, password: 'secret123' })
      .expect(201);

    await stranger
      .patch(`/samples/${created.body.id}`)
      .send({ title: 'hijacked' })
      .expect(403);
  });
});
