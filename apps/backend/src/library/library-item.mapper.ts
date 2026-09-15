import { Prisma } from '@prisma/client';
import { LibraryItem, LibraryStatus } from '@retrosampled/shared';
import { publicUrlForKey } from '../common/storage-url';

/**
 * Everything the library needs from a sample row, in one `include`. Built
 * independently of Task 3.1a's `sample.mapper.ts` so the branches merge
 * cleanly; the two can be unified afterwards.
 */
export const LIBRARY_SAMPLE_INCLUDE = {
  owner: { select: { id: true, username: true, avatarKey: true } },
  parent: {
    select: {
      id: true,
      title: true,
      likesCount: true,
      playsCount: true,
      owner: { select: { username: true } },
    },
  },
  tags: { include: { tag: { select: { name: true } } } },
} satisfies Prisma.SampleInclude;

export type LibrarySampleRow = Prisma.SampleGetPayload<{ include: typeof LIBRARY_SAMPLE_INCLUDE }>;

export type LibraryUserContext = {
  userId: string;
  likedSampleIds: Set<string>;
  downloadedSampleIds: Set<string>;
};

export function toLibraryStatus(status: string): LibraryStatus {
  const lowered = status.toLowerCase();
  const known: LibraryStatus[] = ['draft', 'published', 'private', 'processing', 'failed'];
  return known.includes(lowered as LibraryStatus) ? (lowered as LibraryStatus) : 'draft';
}

/** Text the tab-scoped search matches against (spec: title, creator, tags, bpm, key, original). */
export function searchText(sample: LibrarySampleRow): string {
  return [
    sample.title,
    sample.owner.username,
    ...sample.tags.map((entry) => entry.tag.name),
    sample.bpm?.toString() ?? '',
    sample.musicalKey ?? '',
    sample.parent?.title ?? '',
    sample.parent?.owner.username ?? '',
  ]
    .join(' ')
    .toLowerCase();
}

export function toLibraryItem(sample: LibrarySampleRow, context: LibraryUserContext): LibraryItem {
  const owned = sample.ownerId === context.userId;
  const isRemake = sample.parentId !== null;

  const item: LibraryItem = {
    id: sample.id,
    type: isRemake ? 'remake' : 'sample',
    title: sample.title,
    creator: {
      id: sample.owner.id,
      username: sample.owner.username,
      avatarUrl: publicUrlForKey(sample.owner.avatarKey),
    },
    coverUrl: publicUrlForKey(sample.coverKey),
    audioPreviewUrl: publicUrlForKey(sample.audioKey),
    waveformUrl: publicUrlForKey(sample.peaksKey),
    durationSec: Math.round(sample.durationSec ?? 0),
    bpm: sample.bpm ?? null,
    key: sample.musicalKey ?? null,
    tags: sample.tags.map((entry) => entry.tag.name),
    stats: {
      plays: sample.playsCount,
      likes: sample.likesCount,
      downloads: sample.downloadsCount,
      remakes: sample.remakesCount,
    },
    userState: {
      liked: context.likedSampleIds.has(sample.id),
      downloaded: context.downloadedSampleIds.has(sample.id),
      owned,
    },
    createdAt: sample.createdAt.toISOString(),
    updatedAt: sample.updatedAt.toISOString(),
  };

  if (owned) {
    item.status = toLibraryStatus(sample.status);
  }

  if (sample.parent) {
    item.originalSample = {
      id: sample.parent.id,
      title: sample.parent.title,
      creatorUsername: sample.parent.owner.username,
    };
  }

  return item;
}
