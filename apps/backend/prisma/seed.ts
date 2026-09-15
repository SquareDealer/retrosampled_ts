import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

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

/**
 * TODO(Task 3.1a): seed the 16 demo samples.
 *
 * Copy `apps/frontend/public/audio/*.wav` through `StoragePort.put` (so the
 * local-fs and s3 drivers behave identically), attach the matching
 * `public/waveforms/*.json` as peaks, rebuild the hierarchy from
 * `SAMPLE_PARENT_MAP` (`apps/frontend/src/api/samples.ts`), then add ~40 likes,
 * ~20 downloads, ~15 follows, ~25 comments (some nested), collaborators, the
 * derived notifications, one DRAFT and one PROCESSING sample, and finish with a
 * `recomputeCounters()` pass.
 */
export async function seedSamples(): Promise<void> {
  console.log('seedSamples(): not implemented yet (Task 3.1a)');
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
