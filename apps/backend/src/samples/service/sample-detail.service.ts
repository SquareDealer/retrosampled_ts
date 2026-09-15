import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  Actor,
  CreatorViewModel,
  SampleDetail,
  SampleStatus,
  can,
} from '@retrosampled/shared';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SampleListRow,
  SampleMapper,
  collaboratorIds,
  listIncludeFor,
  tagNames,
} from '../mappers/sample.mapper';
import { AttributionService } from './attribution.service';
import { SampleAccessService } from './sample-access.service';

/** Children/related rows the actor may see, as a Prisma filter. */
export function visibleSamplesWhere(actor: Actor): Prisma.SampleWhereInput {
  if (!actor) {
    return { status: 'PUBLISHED' };
  }

  if (actor.role === 'ADMIN') {
    return {};
  }

  return {
    OR: [
      { status: 'PUBLISHED' },
      { ownerId: actor.id },
      { collaborators: { some: { userId: actor.id } } },
    ],
  };
}

function isVisible(actor: Actor, row: SampleListRow): boolean {
  return can(actor, 'sample:view', {
    kind: 'sample',
    ownerId: row.ownerId,
    status: row.status as SampleStatus,
    collaboratorIds: collaboratorIds(row),
  });
}

/**
 * Builds the `SampleDetail` payload of `GET /samples/:id`: attribution roles,
 * creator cards with stats, the inherited-from link and the related-samples
 * tree (`rootOriginal`, `inheritedOriginal`, `remakes`).
 */
@Injectable()
export class SampleDetailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SampleAccessService,
    private readonly mapper: SampleMapper,
    private readonly attribution: AttributionService,
  ) {}

  async getDetail(sampleId: string, actor: Actor): Promise<SampleDetail> {
    // Hidden samples 404 here, before anything else is loaded.
    await this.access.assertCan(actor, 'sample:view', sampleId);

    const viewerId = actor?.id;
    const include = listIncludeFor(viewerId);

    const row = await this.prisma.sample.findUniqueOrThrow({
      where: { id: sampleId },
      include: {
        ...include,
        parent: { include },
        children: {
          where: visibleSamplesWhere(actor),
          include,
          orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    const root =
      row.rootId !== row.id
        ? await this.prisma.sample.findUnique({ where: { id: row.rootId }, include })
        : null;

    const parent = row.parent;
    const sampleCollaboratorIds = collaboratorIds(row);
    const creators = await this.buildCreators(row, sampleCollaboratorIds, viewerId);

    const rootVisible = root && isVisible(actor, root) ? root : null;
    const parentVisible = parent && isVisible(actor, parent) ? parent : null;
    const inheritedIsRoot = parent !== null && parent.id === row.rootId;

    return {
      id: row.id,
      title: row.title,
      inheritedFrom: parent ? { id: parent.id, title: parent.title } : undefined,
      authors: [
        { id: row.owner.id, name: `@${row.owner.username}` },
        ...creators
          .filter((creator) => creator.roles.includes('COLLABORATOR') && creator.id !== row.owner.id)
          .map((creator) => ({ id: creator.id, name: `@${creator.username}` })),
      ],
      creators,
      coverUrl: this.mapper.urlFor(row.coverKey),
      bpm: row.bpm ?? 0,
      musicalKey: row.musicalKey ?? '',
      tags: tagNames(row),
      likesCount: row.likesCount,
      isLiked: row.likes.length > 0,
      audioPreviewUrl: this.mapper.urlFor(row.audioKey) ?? '',
      waveformPeaksUrl: this.mapper.urlFor(row.peaksKey),
      duration: row.durationSec ?? undefined,
      relatedSamples: {
        rootOriginal: rootVisible ? this.mapper.toSampleShort(rootVisible) : undefined,
        inheritedOriginal:
          parentVisible && !inheritedIsRoot ? this.mapper.toSampleShort(parentVisible) : undefined,
        remakes: row.children.map((child) => this.mapper.toSampleShort(child)),
      },
      ownerId: row.ownerId,
      ownerUsername: row.owner.username,
      status: row.status as SampleStatus,
      collaboratorIds: sampleCollaboratorIds,
      description: row.description,
      sampleType: row.sampleType,
      processingError: row.processingError,
      parentId: row.parentId,
      rootId: row.rootId,
      audioMime: row.audioMime,
      audioSizeBytes: row.audioSizeBytes,
      downloadsCount: row.downloadsCount,
      playsCount: row.playsCount,
      remakesCount: row.remakesCount,
      commentsCount: row.commentsCount,
      createdAt: row.createdAt.toISOString(),
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    };
  }

  private async buildCreators(
    row: SampleListRow,
    sampleCollaboratorIds: string[],
    viewerId: string | undefined,
  ): Promise<CreatorViewModel[]> {
    const entries = await this.attribution.resolve(row, sampleCollaboratorIds);
    const userIds = entries.map((entry) => entry.userId);

    if (userIds.length === 0) {
      return [];
    }

    const [users, remixed, follows] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          username: true,
          avatarKey: true,
          followersCount: true,
          remakesCount: true,
        },
      }),
      // Distinct parents each creator has remade ("tracks remixed").
      this.prisma.sample.groupBy({
        by: ['ownerId', 'parentId'],
        where: { ownerId: { in: userIds }, parentId: { not: null }, status: 'PUBLISHED' },
      }),
      viewerId
        ? this.prisma.follow.findMany({
            where: { followerId: viewerId, followingId: { in: userIds } },
            select: { followingId: true },
          })
        : Promise.resolve([] as { followingId: string }[]),
    ]);

    const usersById = new Map(users.map((user) => [user.id, user]));
    const tracksRemixedByUser = new Map<string, number>();
    for (const group of remixed) {
      tracksRemixedByUser.set(group.ownerId, (tracksRemixedByUser.get(group.ownerId) ?? 0) + 1);
    }
    const followingIds = new Set(follows.map((follow) => follow.followingId));

    return entries.flatMap((entry) => {
      const user = usersById.get(entry.userId);
      if (!user) {
        return [];
      }

      return [
        {
          id: user.id,
          username: user.username,
          avatarUrl: this.mapper.avatarUrl(user.avatarKey),
          roles: entry.roles,
          stats: {
            followersCount: user.followersCount,
            remakesMadeCount: user.remakesCount,
            tracksRemixedCount: tracksRemixedByUser.get(user.id) ?? 0,
          },
          isFollowing: followingIds.has(user.id),
        },
      ];
    });
  }
}
