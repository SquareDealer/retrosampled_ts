import { Injectable } from '@nestjs/common';
import { Prisma, SampleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryLibraryDto } from './dto/query-library.dto';
import {
  ContinueWorkingItem,
  LibraryItem,
  LibraryResponse,
  LibraryStatus,
  LibraryTab,
} from './library.types';

const DEFAULT_LIMIT = 20;

const sampleInclude = Prisma.validator<Prisma.SampleDefaultArgs>()({
  include: {
    owner: { include: { profile: true } },
    parent: { include: { owner: { include: { profile: true } } } },
    _count: { select: { likes: true, downloads: true, children: true } },
  },
});
type SampleRow = Prisma.SampleGetPayload<typeof sampleInclude>;

@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService) {}

  async getItems(
    query: QueryLibraryDto,
    userId: string,
  ): Promise<LibraryResponse> {
    const tab: LibraryTab = query.tab ?? 'liked';
    const limit = query.limit ?? DEFAULT_LIMIT;
    const offset = this.decodeCursor(query.cursor);

    let rows: SampleRow[];
    switch (tab) {
      case 'downloaded':
        rows = await this.downloadedRows(query, userId, offset, limit + 1);
        break;
      case 'uploads':
        rows = await this.ownedRows(query, userId, 'SAMPLE', offset, limit + 1);
        break;
      case 'remakes':
        rows = await this.ownedRows(query, userId, 'REMAKE', offset, limit + 1);
        break;
      case 'liked':
      default:
        rows = await this.likedRows(query, userId, offset, limit + 1);
        break;
    }

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    // Per-item user state.
    const ids = page.map((s) => s.id);
    const [likedSet, downloadedSet] = await Promise.all([
      this.userSampleSet('like', userId, ids),
      this.userSampleSet('download', userId, ids),
    ]);

    const items = page.map((s) =>
      this.toItem(s, userId, likedSet, downloadedSet),
    );

    return {
      items,
      nextCursor: hasMore ? this.encodeCursor(offset + limit) : null,
    };
  }

  async continueWorking(userId: string): Promise<{ items: ContinueWorkingItem[] }> {
    const rows = await this.prisma.sample.findMany({
      where: { ownerId: userId },
      orderBy: [{ updatedAt: 'desc' }],
      take: 10,
    });

    const items: ContinueWorkingItem[] = [];
    for (const s of rows) {
      if (items.length >= 3) break;
      let label: string;
      if (s.status === SampleStatus.DRAFT) {
        label =
          s.kind === 'REMAKE'
            ? `Draft remake: ${s.title}`
            : `Draft upload: ${s.title}`;
      } else {
        label = `Last opened: ${s.title}`;
      }
      items.push({ id: s.id, label, title: s.title, href: `/sample/${s.id}` });
    }

    return { items };
  }

  // --- per-tab queries -----------------------------------------------------

  private async likedRows(
    query: QueryLibraryDto,
    userId: string,
    offset: number,
    take: number,
  ): Promise<SampleRow[]> {
    const links = await this.prisma.like.findMany({
      where: { userId, sample: this.searchFilter(query) },
      orderBy: this.joinOrder(query.sort, 'recently-liked'),
      skip: offset,
      take,
      include: { sample: sampleInclude },
    });
    return links.map((l) => l.sample);
  }

  private async downloadedRows(
    query: QueryLibraryDto,
    userId: string,
    offset: number,
    take: number,
  ): Promise<SampleRow[]> {
    // A sample can be downloaded more than once. Prisma's `distinct` combined
    // with skip/take de-duplicates *after* the SQL LIMIT/OFFSET, which skips or
    // dupes rows across pages. Instead, collapse to distinct sampleIds first
    // (via groupBy on the latest download), then filter, sort and paginate.
    const grouped = await this.prisma.download.groupBy({
      by: ['sampleId'],
      where: { userId },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
    });
    if (grouped.length === 0) {
      return [];
    }

    const recencyIndex = new Map<string, number>();
    grouped.forEach((g, i) => recencyIndex.set(g.sampleId, i));

    const filter = this.searchFilter(query);
    if (query.type) {
      filter.accessType = query.type === 'premium' ? 'PREMIUM' : 'FREE';
    }

    const samples = await this.prisma.sample.findMany({
      where: { ...filter, id: { in: grouped.map((g) => g.sampleId) } },
      ...sampleInclude,
    });

    const sorted = this.sortDownloaded(samples, query.sort, recencyIndex);
    return sorted.slice(offset, offset + take);
  }

  private sortDownloaded(
    rows: SampleRow[],
    sort: string | undefined,
    recencyIndex: Map<string, number>,
  ): SampleRow[] {
    const copy = [...rows];
    switch (sort) {
      case 'newest':
        return copy.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        );
      case 'most-popular':
        return copy.sort((a, b) => b._count.likes - a._count.likes);
      case 'recently-downloaded':
      default:
        return copy.sort(
          (a, b) =>
            (recencyIndex.get(a.id) ?? 0) - (recencyIndex.get(b.id) ?? 0),
        );
    }
  }

  private async ownedRows(
    query: QueryLibraryDto,
    userId: string,
    kind: 'SAMPLE' | 'REMAKE',
    offset: number,
    take: number,
  ): Promise<SampleRow[]> {
    const where: Prisma.SampleWhereInput = {
      ...this.searchFilter(query),
      ownerId: userId,
      kind,
    };
    if (query.status) {
      where.status = query.status.toUpperCase() as SampleStatus;
    }
    if (query.type) {
      where.accessType = query.type === 'premium' ? 'PREMIUM' : 'FREE';
    }
    return this.prisma.sample.findMany({
      where,
      orderBy: this.ownedOrder(query.sort),
      skip: offset,
      take,
      ...sampleInclude,
    });
  }

  // --- ordering ------------------------------------------------------------

  private joinOrder(
    sort: string | undefined,
    fallback: string,
  ): Prisma.LikeOrderByWithRelationInput[] {
    const effective = sort ?? fallback;
    switch (effective) {
      case 'newest':
        return [{ sample: { createdAt: 'desc' } }];
      case 'most-popular':
        return [{ sample: { likes: { _count: 'desc' } } }];
      case 'recently-liked':
      case 'recently-downloaded':
      default:
        return [{ createdAt: 'desc' }];
    }
  }

  private ownedOrder(
    sort: string | undefined,
  ): Prisma.SampleOrderByWithRelationInput[] {
    switch (sort) {
      case 'most-played':
        return [{ plays: 'desc' }, { createdAt: 'desc' }];
      case 'most-liked':
        return [{ likes: { _count: 'desc' } }, { createdAt: 'desc' }];
      case 'original-popularity':
        return [{ parent: { likes: { _count: 'desc' } } }, { createdAt: 'desc' }];
      case 'newest':
      default:
        return [{ createdAt: 'desc' }, { id: 'desc' }];
    }
  }

  // --- helpers -------------------------------------------------------------

  private searchFilter(query: QueryLibraryDto): Prisma.SampleWhereInput {
    const term = query.search?.trim();
    if (!term) {
      return {};
    }
    const bpm = Number(term);
    return {
      OR: [
        { title: { contains: term, mode: 'insensitive' } },
        { tags: { has: term.toLowerCase() } },
        { musicalKey: { equals: term, mode: 'insensitive' } },
        ...(Number.isInteger(bpm) ? [{ bpm }] : []),
        {
          owner: {
            profile: { username: { contains: term, mode: 'insensitive' } },
          },
        },
        { parent: { title: { contains: term, mode: 'insensitive' } } },
        {
          parent: {
            owner: {
              profile: { username: { contains: term, mode: 'insensitive' } },
            },
          },
        },
      ],
    };
  }

  private async userSampleSet(
    kind: 'like' | 'download',
    userId: string,
    sampleIds: string[],
  ): Promise<Set<string>> {
    if (sampleIds.length === 0) {
      return new Set();
    }
    const where = { userId, sampleId: { in: sampleIds } };
    const rows =
      kind === 'like'
        ? await this.prisma.like.findMany({ where, select: { sampleId: true } })
        : await this.prisma.download.findMany({
            where,
            select: { sampleId: true },
          });
    return new Set(rows.map((r) => r.sampleId));
  }

  private toItem(
    s: SampleRow,
    userId: string,
    likedSet: Set<string>,
    downloadedSet: Set<string>,
  ): LibraryItem {
    const profile = s.owner.profile;
    const parentProfile = s.parent?.owner.profile;
    return {
      id: s.id,
      type: s.kind === 'REMAKE' ? 'remake' : 'sample',
      title: s.title,
      creator: {
        id: s.ownerId,
        username: profile?.username ? `@${profile.username}` : '@unknown',
        avatarUrl: profile?.avatarUrl ?? null,
      },
      coverUrl: s.coverUrl ?? null,
      audioPreviewUrl: s.audioUrl ?? null,
      waveformUrl: s.waveformUrl ?? null,
      durationSec: s.durationSec,
      bpm: s.bpm,
      key: s.musicalKey,
      tags: s.tags,
      accessType: s.accessType === 'PREMIUM' ? 'premium' : 'free',
      stats: {
        plays: s.plays,
        likes: s._count.likes,
        downloads: s._count.downloads,
        remakes: s._count.children,
      },
      userState: {
        liked: likedSet.has(s.id),
        downloaded: downloadedSet.has(s.id),
        owned: s.ownerId === userId,
      },
      status: s.status.toLowerCase() as LibraryStatus,
      originalSample:
        s.kind === 'REMAKE' && s.parent
          ? {
              id: s.parent.id,
              title: s.parent.title,
              creatorUsername: parentProfile?.username
                ? `@${parentProfile.username}`
                : '@unknown',
            }
          : undefined,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }

  private encodeCursor(offset: number): string {
    return Buffer.from(String(offset)).toString('base64url');
  }

  private decodeCursor(cursor?: string): number {
    if (!cursor) return 0;
    const decoded = Number(Buffer.from(cursor, 'base64url').toString('utf-8'));
    if (Number.isInteger(decoded) && decoded >= 0) return decoded;
    const plain = Number(cursor);
    return Number.isInteger(plain) && plain >= 0 ? plain : 0;
  }
}
