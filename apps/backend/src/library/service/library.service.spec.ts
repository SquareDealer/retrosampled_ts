import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LibrarySampleRow } from '../library-item.mapper';
import { LibraryService } from './library.service';

const ME = 'me';
const OTHER = 'other';

type SampleSeed = Partial<LibrarySampleRow> & { id: string };

function owner(id: string) {
  return { id, username: id === ME ? 'southkid' : 'bagamemphis', avatarKey: null };
}

function makeSample(seed: SampleSeed): LibrarySampleRow {
  const ownerId = seed.ownerId ?? OTHER;
  return {
    ownerId,
    parentId: null,
    rootId: seed.id,
    depth: 0,
    title: `Sample ${seed.id}`,
    description: null,
    status: 'PUBLISHED',
    audioKey: `samples/${seed.id}/audio.wav`,
    audioMime: 'audio/wav',
    audioSizeBytes: 1000,
    coverKey: null,
    peaksKey: null,
    durationSec: 12.4,
    bpm: 90,
    musicalKey: 'Am',
    sampleType: null,
    processingError: null,
    likesCount: 0,
    downloadsCount: 0,
    playsCount: 0,
    remakesCount: 0,
    commentsCount: 0,
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    owner: owner(ownerId),
    parent: null,
    tags: [],
    ...seed,
  };
}

type LikeRow = { id: string; userId: string; sampleId: string; createdAt: Date };
type ActivityRow = { userId: string; sampleId: string; openedAt: Date };

function createPrismaMock(samples: LibrarySampleRow[], likes: LikeRow[], downloads: LikeRow[]) {
  const byId = (id: string) => samples.find((sample) => sample.id === id) as LibrarySampleRow;
  const activities: ActivityRow[] = [];

  return {
    activities,
    like: {
      findMany: jest.fn(async ({ where }: { where: { userId: string; sampleId?: { in: string[] } } }) =>
        likes
          .filter((row) => row.userId === where.userId)
          .filter((row) => !where.sampleId || where.sampleId.in.includes(row.sampleId))
          .map((row) => ({ ...row, sample: byId(row.sampleId) })),
      ),
    },
    download: {
      findMany: jest.fn(async ({ where }: { where: { userId: string; sampleId?: { in: string[] } } }) =>
        downloads
          .filter((row) => row.userId === where.userId)
          .filter((row) => !where.sampleId || where.sampleId.in.includes(row.sampleId))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((row) => ({ ...row, sample: byId(row.sampleId) })),
      ),
    },
    sample: {
      findMany: jest.fn(
        async ({
          where,
        }: {
          where: { ownerId: string; parentId?: null | { not: null }; status?: string | { in: string[] } };
        }) =>
          samples.filter((sample) => {
            if (sample.ownerId !== where.ownerId) return false;
            if (where.parentId === null && sample.parentId !== null) return false;
            if (where.parentId && typeof where.parentId === 'object' && sample.parentId === null) return false;
            if (typeof where.status === 'string' && sample.status !== where.status) return false;
            if (where.status && typeof where.status === 'object' && !where.status.in.includes(sample.status)) {
              return false;
            }
            return true;
          }),
      ),
    },
    recentActivity: {
      upsert: jest.fn(
        async ({ where }: { where: { userId_sampleId: { userId: string; sampleId: string } } }) => {
          const key = where.userId_sampleId;
          const existing = activities.find(
            (row) => row.userId === key.userId && row.sampleId === key.sampleId,
          );
          if (existing) {
            existing.openedAt = new Date();
            return existing;
          }
          const row = { ...key, openedAt: new Date() };
          activities.push(row);
          return row;
        },
      ),
      findMany: jest.fn(
        async ({ where }: { where: { userId: string; sampleId: { notIn: string[] } } }) =>
          activities
            .filter((row) => row.userId === where.userId && !where.sampleId.notIn.includes(row.sampleId))
            .sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime())
            .map((row) => ({ ...row, sample: byId(row.sampleId) })),
      ),
    },
  };
}

const storage = { publicUrl: (key: string) => `http://storage.test/uploads/${key}` };

describe('LibraryService', () => {
  const day = (n: number) => new Date(Date.UTC(2026, 0, n));

  const samples: LibrarySampleRow[] = [
    makeSample({ id: 'a', likesCount: 5, playsCount: 10, createdAt: day(1) }),
    makeSample({ id: 'b', likesCount: 50, playsCount: 1, createdAt: day(2) }),
    makeSample({ id: 'c', likesCount: 1, playsCount: 100, createdAt: day(3), status: 'PRIVATE' }),
    makeSample({ id: 'u1', ownerId: ME, likesCount: 3, playsCount: 30, createdAt: day(4) }),
    makeSample({ id: 'u2', ownerId: ME, likesCount: 9, playsCount: 2, createdAt: day(5), status: 'DRAFT' }),
    makeSample({
      id: 'r1',
      ownerId: ME,
      parentId: 'a',
      likesCount: 2,
      createdAt: day(6),
      parent: { id: 'a', title: 'Dusty Loop', likesCount: 5, playsCount: 10, owner: { username: 'bagamemphis' } },
      tags: [{ sampleId: 'r1', tagId: 't', tag: { name: 'lofi' } }],
    }),
    makeSample({
      id: 'r2',
      ownerId: ME,
      parentId: 'b',
      likesCount: 7,
      createdAt: day(7),
      status: 'PRIVATE',
      parent: { id: 'b', title: 'Retro Vibes', likesCount: 50, playsCount: 1, owner: { username: 'bagamemphis' } },
    }),
  ];

  const likes: LikeRow[] = [
    { id: 'l1', userId: ME, sampleId: 'a', createdAt: day(20) },
    { id: 'l2', userId: ME, sampleId: 'b', createdAt: day(10) },
    { id: 'l3', userId: ME, sampleId: 'c', createdAt: day(30) },
    { id: 'l4', userId: OTHER, sampleId: 'b', createdAt: day(31) },
  ];

  const downloads: LikeRow[] = [
    { id: 'd1', userId: ME, sampleId: 'b', createdAt: day(11) },
    { id: 'd2', userId: ME, sampleId: 'a', createdAt: day(12) },
    { id: 'd3', userId: ME, sampleId: 'b', createdAt: day(13) },
  ];

  let prisma: ReturnType<typeof createPrismaMock>;
  let service: LibraryService;

  beforeEach(() => {
    prisma = createPrismaMock(samples, likes, downloads);
    service = new LibraryService(prisma as unknown as PrismaService, storage as never);
  });

  const ids = (response: { items: Array<{ id: string }> }) => response.items.map((item) => item.id);

  describe('sort keys', () => {
    it('liked: recently-liked uses the like timestamp, hides samples no longer visible', async () => {
      const response = await service.getItems(ME, { tab: 'liked' });

      expect(ids(response)).toEqual(['a', 'b']);
      expect(response.items[0].userState).toEqual({ liked: true, downloaded: true, owned: false });
      expect(response.items[0].status).toBeUndefined();
    });

    it('liked: most-popular and newest', async () => {
      expect(ids(await service.getItems(ME, { tab: 'liked', sort: 'most-popular' }))).toEqual(['b', 'a']);
      expect(ids(await service.getItems(ME, { tab: 'liked', sort: 'newest' }))).toEqual(['b', 'a']);
    });

    it('downloaded: dedupes repeated downloads and orders by the latest one', async () => {
      const response = await service.getItems(ME, { tab: 'downloaded' });

      expect(ids(response)).toEqual(['b', 'a']);
      expect(response.items.every((item) => item.userState.downloaded)).toBe(true);
    });

    it('uploads: newest / most-played / most-liked with status for every item', async () => {
      const newest = await service.getItems(ME, { tab: 'uploads' });
      expect(ids(newest)).toEqual(['u2', 'u1']);
      expect(newest.items.map((item) => item.status)).toEqual(['draft', 'published']);
      expect(newest.items.every((item) => item.type === 'sample' && item.userState.owned)).toBe(true);

      expect(ids(await service.getItems(ME, { tab: 'uploads', sort: 'most-played' }))).toEqual(['u1', 'u2']);
      expect(ids(await service.getItems(ME, { tab: 'uploads', sort: 'most-liked' }))).toEqual(['u2', 'u1']);
    });

    it('uploads: status filter', async () => {
      expect(ids(await service.getItems(ME, { tab: 'uploads', status: 'draft' }))).toEqual(['u2']);
    });

    it('remakes: newest / most-liked / original-popularity with originalSample', async () => {
      const newest = await service.getItems(ME, { tab: 'remakes' });
      expect(ids(newest)).toEqual(['r2', 'r1']);
      expect(newest.items[1]).toMatchObject({
        type: 'remake',
        status: 'published',
        tags: ['lofi'],
        originalSample: { id: 'a', title: 'Dusty Loop', creatorUsername: 'bagamemphis' },
      });

      expect(ids(await service.getItems(ME, { tab: 'remakes', sort: 'most-liked' }))).toEqual(['r2', 'r1']);
      expect(ids(await service.getItems(ME, { tab: 'remakes', sort: 'original-popularity' }))).toEqual(['r2', 'r1']);
      expect(ids(await service.getItems(ME, { tab: 'remakes', status: 'private' }))).toEqual(['r2']);
    });
  });

  describe('search', () => {
    it('matches the original title and creator for remakes, tags and bpm', async () => {
      expect(ids(await service.getItems(ME, { tab: 'remakes', search: 'dusty' }))).toEqual(['r1']);
      expect(ids(await service.getItems(ME, { tab: 'remakes', search: 'LOFI' }))).toEqual(['r1']);
      expect(ids(await service.getItems(ME, { tab: 'liked', search: '90' }))).toEqual(['a', 'b']);
      expect(ids(await service.getItems(ME, { tab: 'liked', search: 'nothing' }))).toEqual([]);
    });
  });

  describe('cursor', () => {
    it('round-trips through every page', async () => {
      const first = await service.getItems(ME, { tab: 'liked', limit: 1 });
      expect(ids(first)).toEqual(['a']);
      expect(first.nextCursor).toEqual(expect.any(String));

      const second = await service.getItems(ME, { tab: 'liked', limit: 1, cursor: first.nextCursor as string });
      expect(ids(second)).toEqual(['b']);
      expect(second.nextCursor).toBeNull();
    });

    it('rejects a cursor when tab, sort, search or status changed', async () => {
      const first = await service.getItems(ME, { tab: 'liked', limit: 1 });
      const cursor = first.nextCursor as string;

      await expect(service.getItems(ME, { tab: 'liked', sort: 'newest', limit: 1, cursor })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.getItems(ME, { tab: 'downloaded', limit: 1, cursor })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.getItems(ME, { tab: 'liked', search: 'x', limit: 1, cursor })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.getItems(ME, { tab: 'liked', limit: 1, cursor: 'garbage' })).rejects.toThrow('INVALID_QUERY');
    });

    it('rejects sorts and filters that do not belong to the tab', async () => {
      await expect(service.getItems(ME, { tab: 'liked', sort: 'most-played' })).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.getItems(ME, { tab: 'liked', status: 'draft' })).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.getItems(ME, { tab: 'remakes', status: 'failed' })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('continue working', () => {
    it('lists drafts first, then the last opened sample, at most three', async () => {
      await service.touch(ME, 'a');
      prisma.activities[0].openedAt = day(1);
      await service.touch(ME, 'b');

      const items = await service.getContinueWorking(ME);

      expect(items).toHaveLength(3);
      expect(items[0]).toEqual({ id: 'draft-u2', label: 'Draft upload', title: 'Sample u2', href: '/sample/u2/edit' });
      expect(items[1]).toMatchObject({ label: 'Last opened', title: 'Sample b', href: '/sample/b' });
      expect(items[2]).toMatchObject({ label: 'Last opened', title: 'Sample a' });
    });

    it('touch upserts one row per (user, sample)', async () => {
      await service.touch(ME, 'a');
      await service.touch(ME, 'a');

      expect(prisma.activities).toHaveLength(1);
    });

    it('returns an empty list without activity', async () => {
      prisma = createPrismaMock(samples.filter((s) => s.status !== 'DRAFT'), likes, downloads);
      service = new LibraryService(prisma as unknown as PrismaService, storage as never);

      expect(await service.getContinueWorking(ME)).toEqual([]);
    });
  });
});
