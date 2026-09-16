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
 * Follows / comments / notifications are seeded by `seedSocial()` below.
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

// --- Task 3.2: follows, comments, notifications, recent activity ------------

const SEED_FOLLOWS: Array<[string, string]> = [
  ['southkid', 'bagamemphis'],
  ['southkid', 'vhsghost'],
  ['southkid', 'nimbus'],
  ['bagamemphis', 'southkid'],
  ['bagamemphis', 'cassette'],
  ['bagamemphis', 'nimbus'],
  ['vhsghost', 'southkid'],
  ['vhsghost', 'bagamemphis'],
  ['vhsghost', 'cassette'],
  ['nimbus', 'southkid'],
  ['nimbus', 'vhsghost'],
  ['nimbus', 'bagamemphis'],
  ['cassette', 'southkid'],
  ['cassette', 'nimbus'],
  ['admin', 'southkid'],
];

const SEED_COMMENT_TEXTS = [
  'This chop is filthy. Instant download.',
  'The tape hiss on this one is perfect.',
  'What did you run this through? Sounds like an SP-404.',
  'Flipped this into a whole beat last night, thank you.',
  'Key is slightly off from what is tagged, but still fire.',
  'Need more like this.',
  'Those drums sit so well under it.',
  'Bookmarking for the next session.',
  'Remake incoming.',
  'That intro swell is wild.',
  'Warm as a cassette left on the dashboard.',
  'Reminds me of a late 90s boom bap record.',
  'Could you drop a version without the vinyl crackle?',
  'Best upload on here this week.',
  'Layered this under a Rhodes loop and it just works.',
];

const SEED_REPLY_TEXTS = [
  'Appreciate it!',
  'Cassette deck into a cheap interface, nothing fancy.',
  'Send the beat over when it is done.',
  'Good catch, fixing the tag.',
  'Same here, on repeat.',
  'On it.',
  'Thanks, more coming this weekend.',
  'Glad it landed.',
  'Yes, the dry version goes up next week.',
  'Exactly the vibe I was going for.',
];

/**
 * Seeds the social graph: ~15 follows, ~25 comments (with replies) spread
 * over the published samples, the notifications those actions would have
 * produced, and a few RecentActivity rows for "Continue working".
 *
 * Idempotent (deterministic ids + upserts) and tolerant of an empty samples
 * table: without samples only the follows and FOLLOW notifications land.
 */
export async function seedSocial(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { username: { in: SEED_USERS.map((user) => user.username) } },
    select: { id: true, username: true },
  });
  const idByUsername = new Map(users.map((user) => [user.username, user.id]));
  const userId = (username: string): string => {
    const id = idByUsername.get(username);
    if (!id) throw new Error(`seedSocial: user ${username} missing (run seedUsers first)`);
    return id;
  };

  const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

  // --- follows ---------------------------------------------------------------
  let followIndex = 0;
  for (const [follower, following] of SEED_FOLLOWS) {
    followIndex += 1;
    const followerId = userId(follower);
    const followingId = userId(following);
    const createdAt = minutesAgo(60 * 24 * (SEED_FOLLOWS.length - followIndex) + 30);

    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId, followingId } },
      update: {},
      create: { id: `seed-follow-${followIndex}`, followerId, followingId, createdAt },
    });

    await prisma.notification.upsert({
      where: { id: `seed-notif-follow-${followIndex}` },
      update: {},
      create: {
        id: `seed-notif-follow-${followIndex}`,
        userId: followingId,
        actorId: followerId,
        type: 'FOLLOW',
        data: '{}',
        readAt: followIndex % 3 === 0 ? createdAt : null,
        createdAt,
      },
    });
  }

  // --- comments (only when samples exist) -----------------------------------
  const samples = await prisma.sample.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, ownerId: true },
  });

  const commenters = SEED_USERS.filter((user) => user.role === 'USER').map((user) => user.username);
  let commentCount = 0;

  if (samples.length > 0) {
    let textIndex = 0;
    let replyIndex = 0;

    for (let i = 0; i < 15; i += 1) {
      const sample = samples[i % samples.length];
      const author = commenters[(i * 2) % commenters.length];
      const authorId = userId(author);
      const commentId = `seed-comment-${i + 1}`;
      const createdAt = minutesAgo(60 * (40 - i * 2));

      await prisma.comment.upsert({
        where: { id: commentId },
        update: {},
        create: {
          id: commentId,
          sampleId: sample.id,
          userId: authorId,
          text: SEED_COMMENT_TEXTS[textIndex % SEED_COMMENT_TEXTS.length],
          createdAt,
        },
      });
      textIndex += 1;
      commentCount += 1;

      await prisma.notification.upsert({
        where: { id: `seed-notif-${commentId}` },
        update: {},
        create: {
          id: `seed-notif-${commentId}`,
          userId: sample.ownerId,
          actorId: authorId,
          type: 'COMMENT',
          sampleId: sample.id,
          commentId,
          data: '{}',
          readAt: i % 4 === 0 ? createdAt : null,
          createdAt,
        },
      }).catch(() => undefined); // self-comment: recipient === actor is fine to skip

      // Two out of three threads get a reply from the sample owner or another user.
      if (i % 3 !== 2) {
        const replier =
          sample.ownerId !== authorId
            ? sample.ownerId
            : userId(commenters[(i * 2 + 1) % commenters.length]);
        const replyId = `seed-reply-${i + 1}`;
        const replyAt = new Date(createdAt.getTime() + 25 * 60_000);

        await prisma.comment.upsert({
          where: { id: replyId },
          update: {},
          create: {
            id: replyId,
            sampleId: sample.id,
            userId: replier,
            parentId: commentId,
            text: SEED_REPLY_TEXTS[replyIndex % SEED_REPLY_TEXTS.length],
            createdAt: replyAt,
          },
        });
        replyIndex += 1;
        commentCount += 1;

        if (replier !== authorId) {
          await prisma.notification.upsert({
            where: { id: `seed-notif-${replyId}` },
            update: {},
            create: {
              id: `seed-notif-${replyId}`,
              userId: authorId,
              actorId: replier,
              type: 'COMMENT_REPLY',
              sampleId: sample.id,
              commentId: replyId,
              data: '{}',
              readAt: null,
              createdAt: replyAt,
            },
          });
        }
      }
    }

    // --- recent activity ("Last opened") -------------------------------------
    for (const [index, username] of commenters.entries()) {
      const sample = samples[(index + 1) % samples.length];
      await prisma.recentActivity.upsert({
        where: { userId_sampleId: { userId: userId(username), sampleId: sample.id } },
        update: { openedAt: minutesAgo(15 * (index + 1)) },
        create: {
          userId: userId(username),
          sampleId: sample.id,
          openedAt: minutesAgo(15 * (index + 1)),
        },
      });
    }
  }

  // --- counters --------------------------------------------------------------
  for (const user of users) {
    const [followersCount, followingCount] = await Promise.all([
      prisma.follow.count({ where: { followingId: user.id } }),
      prisma.follow.count({ where: { followerId: user.id } }),
    ]);
    await prisma.user.update({
      where: { id: user.id },
      data: { followersCount, followingCount },
    });
  }

  for (const sample of samples) {
    const commentsCount = await prisma.comment.count({
      where: { sampleId: sample.id, deletedAt: null },
    });
    await prisma.sample.update({ where: { id: sample.id }, data: { commentsCount } });
  }

  console.log(
    `Seeded ${SEED_FOLLOWS.length} follows, ${commentCount} comments (${samples.length} published samples)`,
  );
}

async function main(): Promise<void> {
  await seedUsers();
  await seedSamples();
  await seedSocial();
  await recomputeCounters();
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
