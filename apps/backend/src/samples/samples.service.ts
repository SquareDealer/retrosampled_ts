import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Sample, SampleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QuerySamplesDto } from './dto/query-samples.dto';
import {
  CreatorRole,
  CreatorViewModel,
  FeedResponse,
  FeedSample,
  ROLE_PRIORITY,
  SampleDetail,
  SampleShort,
  formatDuration,
} from './sample.types';

const DEFAULT_LIMIT = 20;

const sampleWithRelations = Prisma.validator<Prisma.SampleDefaultArgs>()({
  include: {
    owner: { include: { profile: true } },
    creators: { include: { user: { include: { profile: true } } } },
    _count: { select: { likes: true, downloads: true, children: true } },
  },
});

type SampleWithRelations = Prisma.SampleGetPayload<typeof sampleWithRelations>;

@Injectable()
export class SamplesService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Feed ----------------------------------------------------------------

  async getFeed(
    query: QuerySamplesDto,
    viewerId?: string,
  ): Promise<FeedResponse> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const offset = this.decodeCursor(query.cursor);

    const where: Prisma.SampleWhereInput = {
      status: SampleStatus.PUBLISHED,
      kind: 'SAMPLE',
    };

    const and: Prisma.SampleWhereInput[] = [];

    if (query.search?.trim()) {
      const term = query.search.trim();
      and.push({
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { tags: { has: term.toLowerCase() } },
          {
            owner: {
              profile: { username: { contains: term, mode: 'insensitive' } },
            },
          },
        ],
      });
    }

    if (query.tags?.length) {
      where.tags = { hasEvery: query.tags };
    }
    if (query.bpm_min !== undefined || query.bpm_max !== undefined) {
      where.bpm = {
        ...(query.bpm_min !== undefined ? { gte: query.bpm_min } : {}),
        ...(query.bpm_max !== undefined ? { lte: query.bpm_max } : {}),
      };
    }
    if (query.key) {
      where.musicalKey = query.key;
    }
    if (query.type) {
      where.accessType = query.type === 'premium' ? 'PREMIUM' : 'FREE';
    }
    if (query.sort === 'liked') {
      if (!viewerId) {
        return { samples: [], nextCursor: undefined };
      }
      and.push({ likes: { some: { userId: viewerId } } });
    }
    if (and.length) {
      where.AND = and;
    }

    const orderBy = this.feedOrderBy(query.sort);

    const rows = await this.prisma.sample.findMany({
      where,
      orderBy,
      skip: offset,
      take: limit + 1, // fetch one extra to detect a next page
      ...sampleWithRelations,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    // Resolve children (remakes) for the page in one query.
    const ids = page.map((s) => s.id);
    const children = ids.length
      ? await this.prisma.sample.findMany({
          where: { parentId: { in: ids } },
          ...sampleWithRelations,
        })
      : [];

    const likedSet = await this.likedSet(viewerId, [
      ...page.map((s) => s.id),
      ...children.map((c) => c.id),
    ]);

    const childrenByParent = new Map<string, SampleWithRelations[]>();
    for (const child of children) {
      const list = childrenByParent.get(child.parentId!) ?? [];
      list.push(child);
      childrenByParent.set(child.parentId!, list);
    }

    const samples = page.map((s) =>
      this.toFeedSample(s, likedSet, childrenByParent.get(s.id) ?? []),
    );

    return {
      samples,
      nextCursor: hasMore ? this.encodeCursor(offset + limit) : undefined,
    };
  }

  private feedOrderBy(
    sort: QuerySamplesDto['sort'],
  ): Prisma.SampleOrderByWithRelationInput[] {
    switch (sort) {
      case 'popular':
        return [{ likes: { _count: 'desc' } }, { createdAt: 'desc' }];
      case 'remakes':
        return [{ children: { _count: 'desc' } }, { createdAt: 'desc' }];
      case 'newest':
      case 'liked':
      default:
        return [{ createdAt: 'desc' }, { id: 'desc' }];
    }
  }

  // --- Detail --------------------------------------------------------------

  async getDetail(id: string, viewerId?: string): Promise<SampleDetail> {
    const sample = await this.prisma.sample.findUnique({
      where: { id },
      ...sampleWithRelations,
    });
    if (!sample) {
      throw new NotFoundException('Sample not found');
    }

    // Walk the lineage up to the root ancestor.
    const ancestors = await this.loadAncestors(sample);
    const parent = ancestors[0];
    const root = ancestors.length ? ancestors[ancestors.length - 1] : undefined;

    const children = await this.prisma.sample.findMany({
      where: { parentId: id },
      ...sampleWithRelations,
    });

    const likedSet = await this.likedSet(viewerId, [
      sample.id,
      ...(parent ? [parent.id] : []),
      ...(root ? [root.id] : []),
      ...children.map((c) => c.id),
    ]);
    const followingSet = await this.followingSet(viewerId);

    const ownerProfile = sample.owner.profile;
    const ownerName = ownerProfile?.username ? `@${ownerProfile.username}` : '@unknown';

    return {
      id: sample.id,
      title: sample.title,
      inheritedFrom:
        parent && root && parent.id !== root.id
          ? { id: parent.id, title: parent.title }
          : undefined,
      authors: [{ id: sample.ownerId, name: ownerName }],
      creators: await this.buildCreators(sample, parent, root, followingSet),
      coverUrl: sample.coverUrl,
      bpm: sample.bpm,
      musicalKey: sample.musicalKey,
      tags: sample.tags,
      likesCount: sample._count.likes,
      isLiked: likedSet.has(sample.id),
      audioPreviewUrl: sample.audioUrl,
      waveformPeaksUrl: sample.waveformUrl,
      duration: sample.durationSec || undefined,
      relatedSamples: {
        rootOriginal:
          root && root.id !== sample.id
            ? this.toShort(root, likedSet)
            : undefined,
        inheritedOriginal:
          parent && root && parent.id !== root.id
            ? this.toShort(parent, likedSet)
            : undefined,
        remakes: children.map((c) => this.toShort(c, likedSet)),
      },
    };
  }

  private async loadAncestors(
    sample: Sample,
  ): Promise<SampleWithRelations[]> {
    const ancestors: SampleWithRelations[] = [];
    let parentId = sample.parentId;
    const seen = new Set<string>([sample.id]);

    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = await this.prisma.sample.findUnique({
        where: { id: parentId },
        ...sampleWithRelations,
      });
      if (!parent) {
        break;
      }
      ancestors.push(parent);
      parentId = parent.parentId;
    }
    return ancestors;
  }

  private async buildCreators(
    sample: SampleWithRelations,
    parent: SampleWithRelations | undefined,
    root: SampleWithRelations | undefined,
    followingSet: Set<string>,
  ): Promise<CreatorViewModel[]> {
    const byId = new Map<string, CreatorViewModel>();

    const add = (
      userId: string,
      username: string | null | undefined,
      avatarUrl: string | null | undefined,
      role: CreatorRole,
    ) => {
      const existing = byId.get(userId);
      if (existing) {
        if (!existing.roles.includes(role)) {
          existing.roles = this.sortRoles([...existing.roles, role]);
        }
        return;
      }
      byId.set(userId, {
        id: userId,
        username: username ?? 'unknown',
        avatarUrl: avatarUrl ?? undefined,
        roles: [role],
        stats: { followersCount: 0, remakesMadeCount: 0, tracksRemixedCount: 0 },
        isFollowing: followingSet.has(userId),
      });
    };

    if (root && root.id !== sample.id) {
      add(
        root.ownerId,
        root.owner.profile?.username,
        root.owner.profile?.avatarUrl,
        'OG_CREATOR',
      );
    }
    if (parent && root && parent.id !== root.id) {
      add(
        parent.ownerId,
        parent.owner.profile?.username,
        parent.owner.profile?.avatarUrl,
        'INHERITED_OG_CREATOR',
      );
    }
    add(
      sample.ownerId,
      sample.owner.profile?.username,
      sample.owner.profile?.avatarUrl,
      root && root.id === sample.id ? 'OG_CREATOR' : 'CURRENT_CREATOR',
    );
    for (const collab of sample.creators.filter(
      (c) => c.role === 'COLLABORATOR',
    )) {
      add(
        collab.userId,
        collab.user.profile?.username,
        collab.user.profile?.avatarUrl,
        'COLLABORATOR',
      );
    }

    const creators = Array.from(byId.values());
    await this.fillCreatorStats(creators);

    return creators.sort((a, b) => {
      const rankA = Math.min(...a.roles.map((r) => ROLE_PRIORITY.indexOf(r)));
      const rankB = Math.min(...b.roles.map((r) => ROLE_PRIORITY.indexOf(r)));
      if (rankA !== rankB) return rankA - rankB;
      return a.username.localeCompare(b.username);
    });
  }

  private async fillCreatorStats(creators: CreatorViewModel[]): Promise<void> {
    await Promise.all(
      creators.map(async (creator) => {
        const [followersCount, remakesMadeCount, remixedParents] =
          await Promise.all([
            this.prisma.follow.count({ where: { creatorId: creator.id } }),
            this.prisma.sample.count({
              where: { ownerId: creator.id, kind: 'REMAKE' },
            }),
            this.prisma.sample.findMany({
              where: { ownerId: creator.id, kind: 'REMAKE', parentId: { not: null } },
              select: { parentId: true },
              distinct: ['parentId'],
            }),
          ]);
        creator.stats = {
          followersCount,
          remakesMadeCount,
          tracksRemixedCount: remixedParents.length,
        };
      }),
    );
  }

  // --- Actions -------------------------------------------------------------

  async like(sampleId: string, userId: string): Promise<{ liked: boolean }> {
    await this.ensureSampleExists(sampleId);
    await this.prisma.like.upsert({
      where: { userId_sampleId: { userId, sampleId } },
      create: { userId, sampleId },
      update: {},
    });
    return { liked: true };
  }

  async unlike(sampleId: string, userId: string): Promise<{ liked: boolean }> {
    await this.prisma.like.deleteMany({ where: { userId, sampleId } });
    return { liked: false };
  }

  async registerDownload(
    sampleId: string,
    userId: string,
  ): Promise<{ downloadUrl: string }> {
    const sample = await this.ensureSampleExists(sampleId);
    await this.prisma.download.create({ data: { userId, sampleId } });
    return { downloadUrl: sample.audioUrl };
  }

  async createRemakeDraft(
    sampleId: string,
    userId: string,
  ): Promise<{ id: string }> {
    const original = await this.ensureSampleExists(sampleId);
    const remake = await this.prisma.sample.create({
      data: {
        ownerId: userId,
        kind: 'REMAKE',
        status: SampleStatus.DRAFT,
        title: `${original.title} (remake)`,
        audioUrl: original.audioUrl,
        waveformUrl: original.waveformUrl,
        durationSec: original.durationSec,
        bpm: original.bpm,
        musicalKey: original.musicalKey,
        tags: original.tags,
        parentId: original.id,
      },
    });
    return { id: remake.id };
  }

  async updateVisibility(
    sampleId: string,
    userId: string,
    status: 'published' | 'private',
  ): Promise<{ status: SampleStatus }> {
    await this.ensureOwnership(sampleId, userId);
    const updated = await this.prisma.sample.update({
      where: { id: sampleId },
      data: {
        status:
          status === 'published'
            ? SampleStatus.PUBLISHED
            : SampleStatus.PRIVATE,
      },
    });
    return { status: updated.status };
  }

  async remove(sampleId: string, userId: string): Promise<void> {
    await this.ensureOwnership(sampleId, userId);
    await this.prisma.sample.delete({ where: { id: sampleId } });
  }

  async retryProcessing(
    sampleId: string,
    userId: string,
  ): Promise<{ status: SampleStatus }> {
    const sample = await this.ensureOwnership(sampleId, userId);
    if (sample.status !== SampleStatus.FAILED) {
      throw new BadRequestException('Only failed items can be retried');
    }
    const updated = await this.prisma.sample.update({
      where: { id: sampleId },
      data: { status: SampleStatus.PROCESSING },
    });
    return { status: updated.status };
  }

  // --- helpers -------------------------------------------------------------

  private async ensureSampleExists(id: string): Promise<Sample> {
    const sample = await this.prisma.sample.findUnique({ where: { id } });
    if (!sample) {
      throw new NotFoundException('Sample not found');
    }
    return sample;
  }

  private async ensureOwnership(id: string, userId: string): Promise<Sample> {
    const sample = await this.ensureSampleExists(id);
    if (sample.ownerId !== userId) {
      throw new ForbiddenException('Not the owner');
    }
    return sample;
  }

  private async likedSet(
    viewerId: string | undefined,
    sampleIds: string[],
  ): Promise<Set<string>> {
    if (!viewerId || sampleIds.length === 0) {
      return new Set();
    }
    const likes = await this.prisma.like.findMany({
      where: { userId: viewerId, sampleId: { in: sampleIds } },
      select: { sampleId: true },
    });
    return new Set(likes.map((l) => l.sampleId));
  }

  private async followingSet(
    viewerId: string | undefined,
  ): Promise<Set<string>> {
    if (!viewerId) {
      return new Set();
    }
    const follows = await this.prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { creatorId: true },
    });
    return new Set(follows.map((f) => f.creatorId));
  }

  private sortRoles(roles: CreatorRole[]): CreatorRole[] {
    return [...roles].sort(
      (a, b) => ROLE_PRIORITY.indexOf(a) - ROLE_PRIORITY.indexOf(b),
    );
  }

  private toFeedSample(
    s: SampleWithRelations,
    likedSet: Set<string>,
    children: SampleWithRelations[],
  ): FeedSample {
    const username = s.owner.profile?.username;
    return {
      id: s.id,
      authorId: s.ownerId,
      author: username ? `@${username}` : '@unknown',
      collaboratorIds: s.creators
        .filter((c) => c.role === 'COLLABORATOR')
        .map((c) => c.userId),
      title: s.title,
      tags: s.tags,
      audioUrl: s.audioUrl,
      time: formatDuration(s.durationSec),
      key: s.musicalKey,
      bpm: s.bpm,
      type: s.accessType === 'PREMIUM' ? 'Premium' : undefined,
      price: s.price,
      likesCount: s._count.likes,
      isLiked: likedSet.has(s.id),
      remakesCount: s._count.children,
      remakes: children.map((c) => this.toFeedSample(c, likedSet, [])),
      jsonPeaksUrl: s.waveformUrl,
    };
  }

  private toShort(s: SampleWithRelations, likedSet: Set<string>): SampleShort {
    const username = s.owner.profile?.username;
    return {
      id: s.id,
      authorId: s.ownerId,
      author: username ? `@${username}` : '@unknown',
      title: s.title,
      tags: s.tags,
      audioUrl: s.audioUrl,
      time: formatDuration(s.durationSec),
      key: s.musicalKey,
      bpm: s.bpm,
      price: s.price,
      jsonPeaksUrl: s.waveformUrl,
      likesCount: s._count.likes,
      isLiked: likedSet.has(s.id),
    };
  }

  private encodeCursor(offset: number): string {
    return Buffer.from(String(offset)).toString('base64url');
  }

  private decodeCursor(cursor?: string): number {
    if (!cursor) return 0;
    // Accept both opaque base64 cursors and plain numeric offsets.
    const decoded = Number(Buffer.from(cursor, 'base64url').toString('utf-8'));
    if (Number.isInteger(decoded) && decoded >= 0) return decoded;
    const plain = Number(cursor);
    return Number.isInteger(plain) && plain >= 0 ? plain : 0;
  }
}
