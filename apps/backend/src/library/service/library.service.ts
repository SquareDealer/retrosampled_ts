import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ContinueWorkingItem,
  LibraryQuery,
  LibraryResponse,
  LibraryStatus,
  LibraryTab,
} from '@retrosampled/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE, StoragePort } from '../../storage/storage.port';
import {
  CursorKey,
  afterCursor,
  compareDesc,
  decodeOptionalCursor,
  facetHash,
  takePage,
} from '../../common/pagination/cursor';
import {
  LIBRARY_SAMPLE_INCLUDE,
  LibrarySampleRow,
  searchText,
  toLibraryItem,
} from '../library-item.mapper';

export const LIBRARY_SORTS: Record<LibraryTab, readonly string[]> = {
  liked: ['recently-liked', 'most-popular', 'newest'],
  downloaded: ['recently-downloaded', 'newest', 'most-popular'],
  uploads: ['newest', 'most-played', 'most-liked'],
  remakes: ['newest', 'most-liked', 'original-popularity'],
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const CONTINUE_WORKING_LIMIT = 3;

/** A library candidate: the sample plus the timestamp of the user's own action on it. */
type Candidate = {
  sample: LibrarySampleRow;
  /** Like / Download time for the liked / downloaded tabs. */
  activityAt?: Date;
};

type Keyed = { k: CursorKey; id: string; sample: LibrarySampleRow };

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  // --- items ---------------------------------------------------------------

  /** Sort key per (tab, sort) — the "sort keys" the spec asks each tab to honour. */
  static sortKey(tab: LibraryTab, sort: string, candidate: Candidate): number {
    const { sample, activityAt } = candidate;

    switch (sort) {
      case 'recently-liked':
      case 'recently-downloaded':
        return (activityAt ?? sample.createdAt).getTime();
      case 'most-popular':
      case 'most-liked':
        return sample.likesCount;
      case 'most-played':
        return sample.playsCount;
      case 'original-popularity':
        return sample.parent?.likesCount ?? 0;
      case 'newest':
      default:
        return sample.createdAt.getTime();
    }
  }

  private resolveSort(tab: LibraryTab, sort: string | undefined): string {
    const allowed = LIBRARY_SORTS[tab];

    if (sort === undefined || sort === '') {
      return allowed[0];
    }

    if (!allowed.includes(sort)) {
      throw new BadRequestException('INVALID_QUERY');
    }

    return sort;
  }

  private resolveStatus(tab: LibraryTab, status: LibraryStatus | undefined): string | undefined {
    if (!status) {
      return undefined;
    }

    if (tab === 'liked' || tab === 'downloaded') {
      throw new BadRequestException('INVALID_QUERY');
    }

    if (tab === 'remakes' && (status === 'processing' || status === 'failed')) {
      throw new BadRequestException('INVALID_QUERY');
    }

    return status.toUpperCase();
  }

  /** A liked/downloaded sample the user may no longer see is dropped from the tab. */
  private isVisible(userId: string, sample: LibrarySampleRow): boolean {
    return sample.status === 'PUBLISHED' || sample.ownerId === userId;
  }

  private async loadCandidates(userId: string, tab: LibraryTab, status?: string): Promise<Candidate[]> {
    if (tab === 'liked') {
      const likes = await this.prisma.like.findMany({
        where: { userId },
        include: { sample: { include: LIBRARY_SAMPLE_INCLUDE } },
      });

      return likes
        .filter((like) => this.isVisible(userId, like.sample))
        .map((like) => ({ sample: like.sample, activityAt: like.createdAt }));
    }

    if (tab === 'downloaded') {
      const downloads = await this.prisma.download.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { sample: { include: LIBRARY_SAMPLE_INCLUDE } },
      });

      // Downloads are not unique per sample: keep the most recent one.
      const seen = new Set<string>();
      const candidates: Candidate[] = [];

      for (const download of downloads) {
        if (seen.has(download.sampleId) || !this.isVisible(userId, download.sample)) {
          continue;
        }
        seen.add(download.sampleId);
        candidates.push({ sample: download.sample, activityAt: download.createdAt });
      }

      return candidates;
    }

    const where: Prisma.SampleWhereInput = {
      ownerId: userId,
      parentId: tab === 'uploads' ? null : { not: null },
      ...(status ? { status } : {}),
    };

    const samples = await this.prisma.sample.findMany({
      where,
      include: LIBRARY_SAMPLE_INCLUDE,
    });

    return samples.map((sample) => ({ sample }));
  }

  private async userState(userId: string, sampleIds: string[]) {
    if (sampleIds.length === 0) {
      return { likedSampleIds: new Set<string>(), downloadedSampleIds: new Set<string>() };
    }

    const [likes, downloads] = await Promise.all([
      this.prisma.like.findMany({
        where: { userId, sampleId: { in: sampleIds } },
        select: { sampleId: true },
      }),
      this.prisma.download.findMany({
        where: { userId, sampleId: { in: sampleIds } },
        select: { sampleId: true },
      }),
    ]);

    return {
      likedSampleIds: new Set(likes.map((row) => row.sampleId)),
      downloadedSampleIds: new Set(downloads.map((row) => row.sampleId)),
    };
  }

  /**
   * Implementation note: a user's library is small (their own likes,
   * downloads and uploads), so the tab is loaded once, filtered and keyset
   * paginated in memory. The cursor is still a real `(key, id)` position, not
   * an offset, so it survives inserts. Swap `loadCandidates` for SQL keyset
   * queries when libraries grow beyond a few thousand rows.
   */
  async getItems(userId: string, query: LibraryQuery): Promise<LibraryResponse> {
    const tab: LibraryTab = query.tab ?? 'liked';
    const sort = this.resolveSort(tab, query.sort);
    const status = this.resolveStatus(tab, query.status);
    const search = query.search?.trim().toLowerCase() ?? '';
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

    const hash = facetHash({ userId, tab, sort, status: status ?? null, search });
    const cursor = decodeOptionalCursor(query.cursor, hash);

    const candidates = await this.loadCandidates(userId, tab, status);

    const keyed: Keyed[] = candidates
      .filter((candidate) => !search || searchText(candidate.sample).includes(search))
      .map((candidate) => ({
        k: LibraryService.sortKey(tab, sort, candidate),
        id: candidate.sample.id,
        sample: candidate.sample,
      }))
      .sort(compareDesc);

    const { page, nextCursor } = takePage(afterCursor(keyed, cursor), limit, hash);

    const state = await this.userState(
      userId,
      page.map((entry) => entry.id),
    );

    return {
      items: page.map((entry) => toLibraryItem(entry.sample, { userId, storage: this.storage, ...state })),
      nextCursor,
    };
  }

  // --- continue working ----------------------------------------------------

  /**
   * Records that `userId` opened `sampleId` (backs "Last opened" below).
   * Task 3.1a calls this from the sample detail endpoint for signed-in viewers:
   * `await this.library.touch(user.id, sample.id)` — fire-and-forget is fine.
   */
  async touch(userId: string, sampleId: string): Promise<void> {
    await this.prisma.recentActivity.upsert({
      where: { userId_sampleId: { userId, sampleId } },
      create: { userId, sampleId },
      update: { openedAt: new Date() },
    });
  }

  async getContinueWorking(userId: string): Promise<ContinueWorkingItem[]> {
    const drafts = await this.prisma.sample.findMany({
      where: { ownerId: userId, status: { in: ['DRAFT', 'FAILED'] } },
      orderBy: { updatedAt: 'desc' },
      take: CONTINUE_WORKING_LIMIT,
      select: { id: true, title: true, status: true, parentId: true },
    });

    const items: ContinueWorkingItem[] = drafts.slice(0, CONTINUE_WORKING_LIMIT - 1).map((draft) => {
      const kind = draft.parentId ? 'remake' : 'upload';
      const label = draft.status === 'FAILED' ? `Failed ${kind}` : `Draft ${kind}`;

      return {
        id: `draft-${draft.id}`,
        label,
        title: draft.title,
        href: `/sample/${draft.id}/edit`,
      };
    });

    const excluded = new Set(drafts.map((draft) => draft.id));

    const recent = await this.prisma.recentActivity.findMany({
      where: { userId, sampleId: { notIn: [...excluded] } },
      orderBy: { openedAt: 'desc' },
      take: CONTINUE_WORKING_LIMIT,
      include: { sample: { select: { id: true, title: true, status: true, ownerId: true } } },
    });

    for (const activity of recent) {
      if (items.length >= CONTINUE_WORKING_LIMIT) {
        break;
      }

      if (!this.isVisibleShort(userId, activity.sample)) {
        continue;
      }

      items.push({
        id: `recent-${activity.sample.id}`,
        label: 'Last opened',
        title: activity.sample.title,
        href: `/sample/${activity.sample.id}`,
      });
    }

    return items;
  }

  private isVisibleShort(userId: string, sample: { status: string; ownerId: string }): boolean {
    return sample.status === 'PUBLISHED' || sample.ownerId === userId;
  }
}
