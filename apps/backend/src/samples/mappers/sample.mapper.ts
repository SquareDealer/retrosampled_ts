import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Sample as SampleDto, SampleShort, SampleStatus } from '@retrosampled/shared';
import { STORAGE, StoragePort } from '../../storage/storage.port';

/** Sentinel viewer id that never matches a row, so `likes` comes back empty for guests. */
const GUEST_VIEWER = '__guest__';

export const SAMPLE_OWNER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarKey: true,
} as const;

/**
 * Include shape for list rows: owner, tags, collaborator ids and the viewer's
 * own like (at most one row). Shared by the feed, the profile tabs, related
 * samples and Task 3.2's library so every list maps through the same code.
 */
export const listIncludeFor = (viewerId?: string | null) =>
  Prisma.validator<Prisma.SampleInclude>()({
    owner: { select: SAMPLE_OWNER_SELECT },
    tags: { include: { tag: { select: { name: true } } } },
    collaborators: { select: { userId: true } },
    likes: { where: { userId: viewerId ?? GUEST_VIEWER }, select: { id: true } },
  });

export type SampleListRow = Prisma.SampleGetPayload<{
  include: ReturnType<typeof listIncludeFor>;
}>;

/** Feed rows additionally carry their published remakes for the expandable row. */
export type SampleFeedRow = SampleListRow & { children?: SampleListRow[] };

export const feedIncludeFor = (viewerId?: string | null) =>
  Prisma.validator<Prisma.SampleInclude>()({
    ...listIncludeFor(viewerId),
    children: {
      where: { status: 'PUBLISHED' },
      include: listIncludeFor(viewerId),
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: 20,
    },
  });

/** `m:ss` label used by the player rows. */
export function formatDuration(durationSec: number | null | undefined): string {
  const total = Math.max(0, Math.floor(durationSec ?? 0));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function tagNames(row: Pick<SampleListRow, 'tags'>): string[] {
  return row.tags.map((entry) => entry.tag.name);
}

export function collaboratorIds(row: Pick<SampleListRow, 'collaborators'>): string[] {
  return row.collaborators.map((entry) => entry.userId);
}

/**
 * Prisma row → shared DTOs. URLs are resolved through the storage driver so
 * the local and S3 drivers produce the same payload shapes.
 */
@Injectable()
export class SampleMapper {
  constructor(@Inject(STORAGE) private readonly storage: StoragePort) {}

  urlFor(key: string | null | undefined): string | undefined {
    return key ? this.storage.publicUrl(key) : undefined;
  }

  avatarUrl(avatarKey: string | null | undefined): string | undefined {
    if (!avatarKey) {
      return undefined;
    }

    // Seed data and older rows may already hold an absolute URL or a public path.
    if (/^(https?:)?\/\//.test(avatarKey) || avatarKey.startsWith('/')) {
      return avatarKey;
    }

    return this.storage.publicUrl(avatarKey);
  }

  /** Feed / list shape (`Sample` in `@retrosampled/shared`). */
  toSample(row: SampleFeedRow): SampleDto {
    const remakes = row.children?.map((child) => this.toSample(child));

    return {
      id: row.id,
      authorId: row.owner.id,
      author: `@${row.owner.username}`,
      authorUsername: row.owner.username,
      collaboratorIds: collaboratorIds(row),
      title: row.title,
      tags: tagNames(row),
      audioUrl: this.urlFor(row.audioKey) ?? '',
      time: formatDuration(row.durationSec),
      key: row.musicalKey ?? '',
      bpm: row.bpm ?? '',
      type: row.sampleType ?? undefined,
      likesCount: row.likesCount,
      isLiked: row.likes.length > 0,
      remakesCount: row.remakesCount,
      remakes,
      jsonPeaksUrl: this.urlFor(row.peaksKey),
      status: row.status as SampleStatus,
      coverUrl: this.urlFor(row.coverKey),
      downloadsCount: row.downloadsCount,
      playsCount: row.playsCount,
      createdAt: row.createdAt.toISOString(),
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    };
  }

  /** Compact shape used by the related-samples tree on the sample page. */
  toSampleShort(row: SampleListRow): SampleShort {
    return {
      id: row.id,
      authorId: row.owner.id,
      author: `@${row.owner.username}`,
      title: row.title,
      tags: tagNames(row),
      audioUrl: this.urlFor(row.audioKey) ?? '',
      time: formatDuration(row.durationSec),
      key: row.musicalKey ?? '',
      bpm: row.bpm ?? 0,
      jsonPeaksUrl: this.urlFor(row.peaksKey),
      likesCount: row.likesCount,
      isLiked: row.likes.length > 0,
    };
  }
}
