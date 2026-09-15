import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createStorageFromEnv } from '../src/storage/storage.factory';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;

type SeedUser = {
  username: string;
  email: string;
  password: string;
  role: 'USER' | 'ADMIN';
  displayName?: string;
  bio?: string;
};

const SEED_USERS: SeedUser[] = [
  {
    username: 'admin',
    email: 'admin@example.com',
    password: 'admin123',
    role: 'ADMIN',
    displayName: 'Admin',
    bio: 'Keeping the crates tidy.',
  },
  {
    username: 'southkid',
    email: 'southkid@example.com',
    password: 'user123',
    role: 'USER',
    displayName: 'South Kid',
    bio: 'Dusty loops from the south.',
  },
  {
    username: 'bagamemphis',
    email: 'bagamemphis@example.com',
    password: 'user123',
    role: 'USER',
    displayName: 'Baga Memphis',
    bio: 'Memphis tape worship.',
  },
  {
    username: 'vhsghost',
    email: 'vhsghost@example.com',
    password: 'user123',
    role: 'USER',
    displayName: 'VHS Ghost',
    bio: 'Haunting the analog.',
  },
  {
    username: 'nimbus',
    email: 'nimbus@example.com',
    password: 'user123',
    role: 'USER',
    displayName: 'Nimbus',
    bio: 'Ambient pads, mostly.',
  },
  {
    username: 'cassette',
    email: 'cassette@example.com',
    password: 'user123',
    role: 'USER',
    displayName: 'Cassette',
    bio: 'Side B only.',
  },
];

export async function seedUsers(): Promise<void> {
  for (const user of SEED_USERS) {
    const passwordHash = await bcrypt.hash(user.password, BCRYPT_ROUNDS);

    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        username: user.username,
        role: user.role,
        displayName: user.displayName ?? null,
        bio: user.bio ?? null,
        isActive: true,
      },
      create: {
        email: user.email,
        username: user.username,
        passwordHash,
        role: user.role,
        displayName: user.displayName ?? null,
        bio: user.bio ?? null,
        links: '{}',
      },
    });
  }

  console.log(`Seeded ${SEED_USERS.length} users`);
}

// ---------------------------------------------------------------------------
// Samples (Task 3.1a)
// ---------------------------------------------------------------------------

type SeedSample = {
  /** Stable id (`seed-sample-<slug>`) so re-running the seed updates in place. */
  slug: string;
  /** File name under apps/frontend/public/audio (peaks JSON has the same stem). */
  file: string;
  title: string;
  owner: string;
  /** Slug of the parent sample (remake tree from the old mock SAMPLE_PARENT_MAP). */
  parent?: string;
  tags: string[];
  bpm: number;
  key: string;
  type: 'loop' | 'chop' | 'one-shot';
  collaborators?: string[];
  status?: 'PUBLISHED' | 'DRAFT' | 'PROCESSING';
  description?: string;
};

/**
 * Hierarchy reproduced from the old frontend mock (`SAMPLE_PARENT_MAP`):
 * all-eyes is the root; bullet / astral / bali are its remakes, and so on.
 */
const SEED_SAMPLES: SeedSample[] = [
  { slug: 'all-eyes', file: 'ALL EYES ON ME CHOP.wav', title: 'All Eyes On Me Chop', owner: 'southkid', tags: ['lofi', 'chill', 'ambient'], bpm: 85, key: 'Am', type: 'chop', description: 'Dusty piano chop, straight off the tape.' },
  { slug: 'bullet', file: 'BULLET CHOP.wav', title: 'Bullet Chop', owner: 'nimbus', parent: 'all-eyes', tags: ['retro', 'synth', '80s'], bpm: 120, key: 'Dm', type: 'one-shot', collaborators: ['cassette'] },
  { slug: 'astral', file: 'ASTRAL CHOP.wav', title: 'Astral Chop', owner: 'cassette', parent: 'all-eyes', tags: ['lofi', 'chill', 'ambient'], bpm: 85, key: 'Am', type: 'loop', collaborators: ['southkid'] },
  { slug: 'bali', file: 'BALI CHOP.wav', title: 'Bali Chop', owner: 'nimbus', parent: 'all-eyes', tags: ['lofi', 'chill', 'ambient'], bpm: 85, key: 'Am', type: 'loop' },
  { slug: 'boards', file: 'BOARDS OF CANADA CHOP.wav', title: 'Boards Of Canada Chop', owner: 'bagamemphis', parent: 'bullet', tags: ['lofi', 'chill', 'ambient'], bpm: 85, key: 'Am', type: 'loop', collaborators: ['nimbus', 'admin'] },
  { slug: 'bruno', file: 'BRUNO THEME CHOP.wav', title: 'Bruno Theme Chop', owner: 'bagamemphis', parent: 'boards', tags: ['lofi', 'chill', 'ambient'], bpm: 85, key: 'Am', type: 'chop', collaborators: ['southkid'] },
  { slug: 'buckethead', file: 'BUCKETHEAD ELECTRIC TEARS CHOP.wav', title: 'Buckethead Electric Tears Chop', owner: 'vhsghost', parent: 'astral', tags: ['lofi', 'chill', 'ambient'], bpm: 85, key: 'Am', type: 'chop', collaborators: ['cassette', 'nimbus'] },
  { slug: 'caldera', file: 'CALDERA CHOP.wav', title: 'Caldera Chop', owner: 'southkid', parent: 'bali', tags: ['lofi', 'chill', 'ambient'], bpm: 85, key: 'Am', type: 'chop', collaborators: ['nimbus'] },
  { slug: 'check-out', file: 'CHECK OUT TIME LOOP.wav', title: 'Check Out Time Loop', owner: 'nimbus', parent: 'astral', tags: ['retro', 'synth', '80s'], bpm: 120, key: 'Dm', type: 'loop', collaborators: ['cassette'] },
  { slug: 'checkmates', file: 'CHECKMATES LOOP.wav', title: 'Checkmates Loop', owner: 'cassette', parent: 'bullet', tags: ['retro', 'synth', '80s'], bpm: 120, key: 'Dm', type: 'loop', collaborators: ['nimbus', 'bagamemphis'] },
  { slug: 'cycles', file: 'CYCLES CHOP.wav', title: 'Cycles Chop', owner: 'vhsghost', tags: ['drums', 'retro'], bpm: 92, key: 'Em', type: 'chop' },
  { slug: 'andrezj', file: 'ANDREZJ CHOP.wav', title: 'Andrezj Chop', owner: 'vhsghost', parent: 'cycles', tags: ['drums', 'retro', 'lofi'], bpm: 92, key: 'Em', type: 'chop' },
  { slug: 'david-gold', file: 'DAVID GOLD CHOP.wav', title: 'David Gold Chop', owner: 'bagamemphis', tags: ['synth', 'ambient'], bpm: 100, key: 'C', type: 'loop' },
  { slug: 'demon-choir', file: 'DEMON CHOIR LOOP.wav', title: 'Demon Choir Loop', owner: 'cassette', tags: ['ambient', 'chill'], bpm: 70, key: 'F', type: 'loop', collaborators: ['vhsghost'] },
  { slug: 'piano-sketch', file: 'piano.wav', title: 'Piano Sketch', owner: 'southkid', tags: ['lofi', 'chill'], bpm: 78, key: 'G', type: 'loop', status: 'DRAFT' },
  { slug: 'demo-tape', file: 'demo.mp3', title: 'Demo Tape', owner: 'southkid', tags: ['retro'], bpm: 110, key: 'A', type: 'loop', status: 'PROCESSING' },
];

const FRONTEND_PUBLIC = resolve(__dirname, '../../frontend/public');
const DAY_MS = 24 * 60 * 60 * 1000;

const seedSampleId = (slug: string): string => `seed-sample-${slug}`;

type PeaksFile = { length: number; samples_per_pixel: number; sample_rate: number };

/**
 * Copies `apps/frontend/public/audio/*` through `StoragePort.put` (so the local
 * and S3 drivers behave identically), attaches the matching
 * `public/waveforms/*.json` as peaks, rebuilds the remake hierarchy, adds
 * collaborators, ~40 likes and ~20 downloads, one DRAFT and one PROCESSING
 * sample owned by southkid, then recomputes every counter.
 *
 * Follows / comments / notifications are Task 3.2's (`seedSocial()` stub below).
 */
export async function seedSamples(): Promise<void> {
  const storage = createStorageFromEnv(process.env);
  const users = await prisma.user.findMany({ select: { id: true, username: true } });
  const userIdByName = new Map(users.map((user) => [user.username, user.id]));
  const userId = (username: string): string => {
    const id = userIdByName.get(username);
    if (!id) {
      throw new Error(`seedSamples: user "${username}" is missing; run seedUsers() first`);
    }
    return id;
  };

  const now = Date.now();
  const bySlug = new Map(SEED_SAMPLES.map((sample) => [sample.slug, sample]));

  // Parents are listed before children, so a single pass resolves rootId/depth.
  const resolved = new Map<string, { rootId: string; depth: number }>();

  for (const [index, entry] of SEED_SAMPLES.entries()) {
    const id = seedSampleId(entry.slug);
    const parent = entry.parent ? bySlug.get(entry.parent) : undefined;
    const parentId = parent ? seedSampleId(parent.slug) : null;
    const parentInfo = parent ? resolved.get(parent.slug) : undefined;
    const rootId = parentInfo ? parentInfo.rootId : id;
    const depth = parentInfo ? parentInfo.depth + 1 : 0;
    resolved.set(entry.slug, { rootId, depth });

    const extension = entry.file.slice(entry.file.lastIndexOf('.') + 1).toLowerCase();
    const audioMime = extension === 'mp3' ? 'audio/mpeg' : 'audio/wav';
    const audioBuffer = readFileSync(resolve(FRONTEND_PUBLIC, 'audio', entry.file));
    const audioKey = `samples/${id}/audio.${extension}`;
    await storage.put(audioKey, audioBuffer, { contentType: audioMime });

    const status = entry.status ?? 'PUBLISHED';
    let peaksKey: string | null = null;
    let durationSec: number | null = null;

    if (status !== 'PROCESSING') {
      const stem = entry.file.replace(/\.[^.]+$/, '');
      const peaksBuffer = readFileSync(resolve(FRONTEND_PUBLIC, 'waveforms', `${stem}.json`));
      const peaks = JSON.parse(peaksBuffer.toString('utf8')) as PeaksFile;
      peaksKey = `samples/${id}/peaks.json`;
      await storage.put(peaksKey, peaksBuffer, { contentType: 'application/json' });
      durationSec = (peaks.length * peaks.samples_per_pixel) / peaks.sample_rate;
    }

    // Spread creation dates over the last month so "newest" reads naturally.
    const createdAt = new Date(now - (SEED_SAMPLES.length - index) * 1.7 * DAY_MS);
    const publishedAt = status === 'PUBLISHED' ? createdAt : null;

    const data = {
      ownerId: userId(entry.owner),
      parentId,
      rootId,
      depth,
      title: entry.title,
      description: entry.description ?? null,
      status,
      audioKey,
      audioMime,
      audioSizeBytes: audioBuffer.length,
      peaksKey,
      durationSec,
      bpm: entry.bpm,
      musicalKey: entry.key,
      sampleType: entry.type,
      processingError: null,
      publishedAt,
      createdAt,
    };

    await prisma.sample.upsert({ where: { id }, update: data, create: { id, ...data } });

    // Tags: replace the set.
    await prisma.sampleTag.deleteMany({ where: { sampleId: id } });
    for (const name of entry.tags) {
      const tag = await prisma.tag.upsert({ where: { name }, update: {}, create: { name } });
      await prisma.sampleTag.create({ data: { sampleId: id, tagId: tag.id } });
    }

    // Collaborators: replace the set.
    await prisma.sampleCollaborator.deleteMany({ where: { sampleId: id } });
    for (const username of entry.collaborators ?? []) {
      await prisma.sampleCollaborator.create({ data: { sampleId: id, userId: userId(username) } });
    }
  }

  // Likes (~36) and downloads (~21) on published samples, deterministic.
  const published = SEED_SAMPLES.filter((entry) => (entry.status ?? 'PUBLISHED') === 'PUBLISHED');
  const likers = users.filter((user) => user.username !== 'admin');
  const seedSampleIds = SEED_SAMPLES.map((entry) => seedSampleId(entry.slug));

  await prisma.download.deleteMany({ where: { sampleId: { in: seedSampleIds } } });

  let likesCreated = 0;
  let downloadsCreated = 0;

  for (const [sampleIndex, entry] of published.entries()) {
    const sampleId = seedSampleId(entry.slug);

    for (const [userIndex, user] of likers.entries()) {
      if (user.username === entry.owner) continue;

      if ((sampleIndex * 5 + userIndex * 3) % 7 < 5) {
        await prisma.like.upsert({
          where: { userId_sampleId: { userId: user.id, sampleId } },
          update: {},
          create: {
            userId: user.id,
            sampleId,
            createdAt: new Date(now - ((sampleIndex * 3 + userIndex) % 20) * 0.5 * DAY_MS),
          },
        });
        likesCreated += 1;
      }

      if ((sampleIndex * 3 + userIndex) % 3 === 0) {
        await prisma.download.create({
          data: {
            userId: user.id,
            sampleId,
            createdAt: new Date(now - ((sampleIndex + userIndex) % 12) * DAY_MS),
          },
        });
        downloadsCreated += 1;
      }
    }
  }

  await recomputeCounters();

  console.log(
    `Seeded ${SEED_SAMPLES.length} samples (${published.length} published), ${likesCreated} likes, ${downloadsCreated} downloads`,
  );
}

/** Rebuilds every denormalised counter from the underlying rows. */
export async function recomputeCounters(): Promise<void> {
  const samples = await prisma.sample.findMany({ select: { id: true } });

  for (const { id } of samples) {
    const [likesCount, downloadsCount, remakesCount, commentsCount] = await Promise.all([
      prisma.like.count({ where: { sampleId: id } }),
      prisma.download.count({ where: { sampleId: id } }),
      prisma.sample.count({ where: { parentId: id, status: 'PUBLISHED' } }),
      prisma.comment.count({ where: { sampleId: id, deletedAt: null } }),
    ]);

    await prisma.sample.update({
      where: { id },
      data: { likesCount, downloadsCount, remakesCount, commentsCount },
    });
  }

  const users = await prisma.user.findMany({ select: { id: true } });

  for (const { id } of users) {
    const [uploadsCount, remakesCount, followersCount, followingCount] = await Promise.all([
      prisma.sample.count({ where: { ownerId: id, parentId: null, status: 'PUBLISHED' } }),
      prisma.sample.count({ where: { ownerId: id, parentId: { not: null }, status: 'PUBLISHED' } }),
      prisma.follow.count({ where: { followingId: id } }),
      prisma.follow.count({ where: { followerId: id } }),
    ]);

    await prisma.user.update({
      where: { id },
      data: { uploadsCount, remakesCount, followersCount, followingCount },
    });
  }

  const tags = await prisma.tag.findMany({ select: { id: true } });

  for (const { id } of tags) {
    const usageCount = await prisma.sampleTag.count({ where: { tagId: id } });
    await prisma.tag.update({ where: { id }, data: { usageCount } });
  }
}

/**
 * TODO(Task 3.2): follows (~15), comments (~25, some nested), derived
 * notifications. Call `recomputeCounters()` at the end.
 */
export async function seedSocial(): Promise<void> {
  // intentionally empty until Task 3.2
}

async function main(): Promise<void> {
  await seedUsers();
  await seedSamples();
  await seedSocial();
}

if (require.main === module) {
  main()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}

export { prisma };
