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

async function main(): Promise<void> {
  await seedUsers();
  await seedSamples();
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
