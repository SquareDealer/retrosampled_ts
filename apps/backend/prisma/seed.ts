/**
 * Seed data mirroring the frontend mock dataset
 * (apps/frontend/src/mocks/mockSamples.ts + api/library.ts) so the UI lights
 * up when pointed at the real backend.
 *
 * Idempotent: safe to run repeatedly. Default password for every seeded
 * account is `password123`.
 */
import { PrismaClient, SampleKind, SampleStatus, AccessType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'password123';

type CreatorSeed = { key: string; username: string; bio: string };

const CREATORS: CreatorSeed[] = [
  { key: 'u1', username: 'southkid', bio: 'OG lo-fi chopper.' },
  { key: 'u2', username: 'squaredealer', bio: 'Synthwave & retro edits.' },
  { key: 'u3', username: 'bagamemphis', bio: 'Memphis dust merchant.' },
  { key: 'u4', username: 'vhsghost', bio: 'Tape-warped textures.' },
  { key: 'u5', username: 'astralchild', bio: 'Ambient explorer.' },
  { key: 'u6', username: 'caldera', bio: 'Warm soulful chops.' },
  { key: 'u7', username: 'andrezj', bio: 'Boom-bap loops.' },
  { key: 'u8', username: 'loopmage', bio: 'Loop alchemist.' },
];

type SampleSeed = {
  id: string;
  author: string;
  collaborators?: string[];
  title: string;
  tags: string[];
  audio: string;
  peaks: string;
  durationSec: number;
  key: string;
  bpm: number;
  price: number;
  access: AccessType;
  parentId?: string;
};

const audio = (name: string) => `/audio/${name}`;
const peaks = (name: string) => `/waveforms/${name}`;

const SAMPLES: SampleSeed[] = [
  { id: 'popular-1', author: 'u1', title: 'Lo-Fi Dreams', tags: ['lofi', 'chill', 'ambient'], audio: audio('ALL EYES ON ME CHOP.wav'), peaks: peaks('ALL EYES ON ME CHOP.json'), durationSec: 32, key: 'Am', bpm: 85, price: 50, access: 'FREE' },
  { id: 'popular-2', author: 'u2', collaborators: ['u7'], title: 'Retro Vibes', tags: ['retro', 'synth', '80s'], audio: audio('BULLET CHOP.wav'), peaks: peaks('BULLET CHOP.json'), durationSec: 45, key: 'Dm', bpm: 120, price: 75, access: 'FREE', parentId: 'popular-1' },
  { id: 'popular-3', author: 'u3', collaborators: ['u2', 'u8'], title: 'Lo-Fi Dreams', tags: ['lofi', 'chill', 'ambient'], audio: audio('ALL EYES ON ME CHOP.wav'), peaks: peaks('ALL EYES ON ME CHOP.json'), durationSec: 32, key: 'Am', bpm: 85, price: 50, access: 'FREE', parentId: 'popular-2' },
  { id: 'popular-4', author: 'u3', collaborators: ['u1'], title: 'Lo-Fi Dreams', tags: ['lofi', 'chill', 'ambient'], audio: audio('ALL EYES ON ME CHOP.wav'), peaks: peaks('ALL EYES ON ME CHOP.json'), durationSec: 32, key: 'Am', bpm: 85, price: 50, access: 'FREE', parentId: 'popular-3' },
  { id: 'popular-5', author: 'u4', collaborators: ['u5', 'u2'], title: 'Lo-Fi Dreams', tags: ['lofi', 'chill', 'ambient'], audio: audio('ALL EYES ON ME CHOP.wav'), peaks: peaks('ALL EYES ON ME CHOP.json'), durationSec: 32, key: 'Am', bpm: 85, price: 50, access: 'FREE', parentId: 'premium-1' },
  { id: 'popular-6', author: 'u1', collaborators: ['u6'], title: 'Lo-Fi Dreams', tags: ['lofi', 'chill', 'ambient'], audio: audio('ALL EYES ON ME CHOP.wav'), peaks: peaks('ALL EYES ON ME CHOP.json'), durationSec: 32, key: 'Am', bpm: 85, price: 50, access: 'FREE', parentId: 'liked-1' },
  { id: 'premium-1', author: 'u5', collaborators: ['u1'], title: 'alesha_popovich_type_beat_nowrap', tags: ['lofi', 'chill', 'ambient'], audio: audio('ALL EYES ON ME CHOP.wav'), peaks: peaks('ALL EYES ON ME CHOP.json'), durationSec: 32, key: 'Am', bpm: 85, price: 150, access: 'PREMIUM', parentId: 'popular-1' },
  { id: 'premium-2', author: 'u2', collaborators: ['u5'], title: 'VIP Sample', tags: ['retro', 'synth', '80s'], audio: audio('BULLET CHOP.wav'), peaks: peaks('BULLET CHOP.json'), durationSec: 45, key: 'Dm', bpm: 120, price: 200, access: 'PREMIUM', parentId: 'premium-1' },
  { id: 'liked-1', author: 'u6', title: 'Favorite Track', tags: ['lofi', 'chill', 'ambient'], audio: audio('ALL EYES ON ME CHOP.wav'), peaks: peaks('ALL EYES ON ME CHOP.json'), durationSec: 32, key: 'Am', bpm: 85, price: 50, access: 'FREE', parentId: 'popular-1' },
  { id: 'liked-2', author: 'u7', collaborators: ['u2', 'u3'], title: 'Saved Beat', tags: ['retro', 'synth', '80s'], audio: audio('BULLET CHOP.wav'), peaks: peaks('BULLET CHOP.json'), durationSec: 45, key: 'Dm', bpm: 120, price: 75, access: 'FREE', parentId: 'popular-2' },
];

// Library content owned by the demo "current" user.
type OwnedSeed = {
  id: string;
  kind: SampleKind;
  status: SampleStatus;
  title: string;
  tags: string[];
  audio: string;
  peaks: string;
  durationSec: number;
  key: string;
  bpm: number;
  access: AccessType;
  plays: number;
  parentId?: string;
};

const OWNED: OwnedSeed[] = [
  { id: 'upload-1', kind: 'SAMPLE', status: 'PUBLISHED', title: 'Midnight Arcade Loop', tags: ['arcade', 'loop', 'melody'], audio: audio('ASTRAL CHOP.wav'), peaks: peaks('ASTRAL CHOP.json'), durationSec: 41, key: 'Fm', bpm: 102, access: 'FREE', plays: 211 },
  { id: 'upload-2', kind: 'SAMPLE', status: 'DRAFT', title: 'Draft Upload: VHS Drums Pack', tags: ['drums', 'draft', 'tape'], audio: audio('CHECK OUT TIME LOOP.wav'), peaks: peaks('CHECK OUT TIME LOOP.json'), durationSec: 22, key: 'Em', bpm: 88, access: 'FREE', plays: 0 },
  { id: 'upload-3', kind: 'SAMPLE', status: 'PRIVATE', title: 'Private Choir Texture', tags: ['choir', 'texture', 'private'], audio: audio('DEMON CHOIR LOOP.wav'), peaks: peaks('DEMON CHOIR LOOP.json'), durationSec: 35, key: 'Bm', bpm: 70, access: 'PREMIUM', plays: 51 },
  { id: 'upload-4', kind: 'SAMPLE', status: 'PROCESSING', title: 'Processing Piano Dust', tags: ['piano', 'processing'], audio: audio('piano.wav'), peaks: peaks('piano.json'), durationSec: 19, key: 'A', bpm: 96, access: 'FREE', plays: 0 },
  { id: 'remake-1', kind: 'REMAKE', status: 'DRAFT', title: 'Retro Vibes Night Edit', tags: ['remake', 'synth', 'night'], audio: audio('BOARDS OF CANADA CHOP.wav'), peaks: peaks('BOARDS OF CANADA CHOP.json'), durationSec: 44, key: 'Dm', bpm: 120, access: 'FREE', plays: 144, parentId: 'liked-2' },
  { id: 'remake-2', kind: 'REMAKE', status: 'PUBLISHED', title: 'Lo-Fi Dreams Tape Flip', tags: ['remake', 'lofi', 'tape'], audio: audio('BALI CHOP.wav'), peaks: peaks('BALI CHOP.json'), durationSec: 37, key: 'Am', bpm: 85, access: 'FREE', plays: 322, parentId: 'liked-1' },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const userIdByKey = new Map<string, string>();

  // Creators ----------------------------------------------------------------
  for (const c of CREATORS) {
    const email = `${c.username}@retrosamples.dev`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash,
        emailVerifiedAt: new Date(),
        profile: {
          create: { username: c.username, bio: c.bio, isCreator: true },
        },
      },
    });
    userIdByKey.set(c.key, user.id);
  }

  // Demo "current" user ------------------------------------------------------
  const current = await prisma.user.upsert({
    where: { email: 'you@retrosamples.dev' },
    update: {},
    create: {
      email: 'you@retrosamples.dev',
      passwordHash,
      emailVerifiedAt: new Date(),
      profile: {
        create: {
          username: 'you',
          bio: 'Demo account — uploads, remakes and saves.',
          isCreator: true,
        },
      },
    },
  });

  // Feed samples (two passes so parents exist before children references) -----
  for (const s of SAMPLES) {
    const ownerId = userIdByKey.get(s.author)!;
    await prisma.sample.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        ownerId,
        kind: 'SAMPLE',
        status: 'PUBLISHED',
        title: s.title,
        tags: s.tags,
        audioUrl: s.audio,
        waveformUrl: s.peaks,
        durationSec: s.durationSec,
        bpm: s.bpm,
        musicalKey: s.key,
        accessType: s.access,
        price: s.price,
      },
    });
  }
  // Wire lineage now that every row exists.
  for (const s of SAMPLES) {
    if (s.parentId) {
      await prisma.sample.update({
        where: { id: s.id },
        data: { parentId: s.parentId },
      });
    }
  }

  // Collaborators ------------------------------------------------------------
  for (const s of SAMPLES) {
    for (const collabKey of s.collaborators ?? []) {
      const userId = userIdByKey.get(collabKey);
      if (!userId) continue;
      await prisma.sampleCreator.upsert({
        where: {
          sampleId_userId_role: {
            sampleId: s.id,
            userId,
            role: 'COLLABORATOR',
          },
        },
        update: {},
        create: { sampleId: s.id, userId, role: 'COLLABORATOR' },
      });
    }
  }

  // Owned uploads & remakes for the demo user --------------------------------
  for (const o of OWNED) {
    await prisma.sample.upsert({
      where: { id: o.id },
      update: {},
      create: {
        id: o.id,
        ownerId: current.id,
        kind: o.kind,
        status: o.status,
        title: o.title,
        tags: o.tags,
        audioUrl: o.audio,
        waveformUrl: o.peaks,
        durationSec: o.durationSec,
        bpm: o.bpm,
        musicalKey: o.key,
        accessType: o.access,
        plays: o.plays,
        parentId: o.parentId,
      },
    });
  }

  // Demo user likes & downloads ----------------------------------------------
  const liked = ['liked-1', 'liked-2', 'premium-1'];
  for (const sampleId of liked) {
    await prisma.like.upsert({
      where: { userId_sampleId: { userId: current.id, sampleId } },
      update: {},
      create: { userId: current.id, sampleId },
    });
  }
  const downloaded = ['liked-1', 'premium-1', 'popular-2'];
  for (const sampleId of downloaded) {
    const exists = await prisma.download.findFirst({
      where: { userId: current.id, sampleId },
    });
    if (!exists) {
      await prisma.download.create({ data: { userId: current.id, sampleId } });
    }
  }

  // A few follows so creator stats are non-zero.
  for (const key of ['u1', 'u5', 'u2']) {
    const creatorId = userIdByKey.get(key)!;
    await prisma.follow.upsert({
      where: { followerId_creatorId: { followerId: current.id, creatorId } },
      update: {},
      create: { followerId: current.id, creatorId },
    });
  }

  const counts = {
    users: await prisma.user.count(),
    samples: await prisma.sample.count(),
    likes: await prisma.like.count(),
    downloads: await prisma.download.count(),
  };
  console.log('Seed complete:', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
