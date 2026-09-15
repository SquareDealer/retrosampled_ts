import { Inject, Injectable } from '@nestjs/common';
import { SearchResponse, SearchType } from '@retrosampled/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { publicUrlOrNull } from '../../storage/public-url';
import { STORAGE, StoragePort } from '../../storage/storage.port';

const DEFAULT_LIMIT = 10;

/**
 * Plain `LIKE` search over published samples, active users and tags.
 * SQLite's `LIKE` is case-insensitive for ASCII, which is enough for the MVP;
 * FTS5 / tsvector come later.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  async search(
    rawQuery: string,
    type: SearchType = 'all',
    limit = DEFAULT_LIMIT,
    viewerId?: string,
  ): Promise<SearchResponse> {
    const query = rawQuery.trim().replace(/^[@#]/, '');
    const take = Math.min(Math.max(limit, 1), 50);
    const response: SearchResponse = { query, samples: [], users: [], tags: [] };

    if (!query) {
      return response;
    }

    const wants = (kind: Exclude<SearchType, 'all'>) => type === 'all' || type === kind;

    const [samples, users, tags] = await Promise.all([
      wants('samples')
        ? this.prisma.sample.findMany({
            where: {
              status: 'PUBLISHED',
              OR: [
                { title: { contains: query } },
                { owner: { username: { contains: query } } },
                { tags: { some: { tag: { name: { contains: query } } } } },
              ],
            },
            orderBy: [{ likesCount: 'desc' }, { publishedAt: 'desc' }],
            take,
            select: {
              id: true,
              title: true,
              bpm: true,
              musicalKey: true,
              owner: { select: { id: true, username: true, avatarKey: true } },
            },
          })
        : [],
      wants('users')
        ? this.prisma.user.findMany({
            where: {
              isActive: true,
              OR: [{ username: { contains: query } }, { displayName: { contains: query } }],
            },
            orderBy: [{ followersCount: 'desc' }, { username: 'asc' }],
            take,
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarKey: true,
              followersCount: true,
            },
          })
        : [],
      wants('tags')
        ? this.prisma.tag.findMany({
            where: { name: { contains: query.toLowerCase() } },
            orderBy: [{ usageCount: 'desc' }, { name: 'asc' }],
            take,
            select: { name: true, usageCount: true },
          })
        : [],
    ]);

    const followed = new Set<string>();
    if (viewerId && users.length > 0) {
      const rows = await this.prisma.follow.findMany({
        where: { followerId: viewerId, followingId: { in: users.map((user) => user.id) } },
        select: { followingId: true },
      });
      for (const row of rows) {
        followed.add(row.followingId);
      }
    }

    response.samples = samples.map((sample) => ({
      id: sample.id,
      title: sample.title,
      bpm: sample.bpm ?? null,
      key: sample.musicalKey ?? null,
      owner: {
        id: sample.owner.id,
        username: sample.owner.username,
        avatarUrl: publicUrlOrNull(this.storage, sample.owner.avatarKey),
      },
    }));

    response.users = users.map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName ?? null,
      avatarUrl: publicUrlOrNull(this.storage, user.avatarKey),
      followersCount: user.followersCount,
      isFollowing: followed.has(user.id),
    }));

    response.tags = tags;

    return response;
  }
}
