import { BadRequestException, Injectable } from '@nestjs/common';
import { Comment } from '@prisma/client';
import { Actor, CommentsPageResponse, SampleComment } from '@retrosampled/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/service/notifications.service';
import {
  afterCursor,
  decodeOptionalCursor,
  facetHash,
  takePage,
} from '../../common/pagination/cursor';
import { publicUrlForKey } from '../../common/storage-url';
import { SampleAccessService } from './sample-access.service';
import { CommentSort } from '../dto/comment.dto';

type CommentAuthor = { id: string; username: string; avatarKey: string | null };
type CommentRow = Comment & { user: CommentAuthor };
type ThreadRow = CommentRow & { replies: CommentRow[] };

const AUTHOR_SELECT = { id: true, username: true, avatarKey: true } as const;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export type ListCommentsOptions = {
  sort?: CommentSort;
  cursor?: string;
  limit?: number;
};

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SampleAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  private toDto(row: CommentRow, actor: Actor, replies?: CommentRow[]): SampleComment {
    const dto: SampleComment = {
      id: row.id,
      user: {
        id: row.user.id,
        username: row.user.username,
        avatarUrl: publicUrlForKey(row.user.avatarKey) ?? undefined,
      },
      text: row.text,
      createdAt: row.createdAt.toISOString(),
      isOwner: actor !== null && actor.id === row.userId,
    };

    if (row.parentId) {
      dto.parentId = row.parentId;
    }

    if (replies) {
      dto.replies = replies.map((reply) => this.toDto(reply, actor));
    }

    return dto;
  }

  /**
   * Sort key for the keyset cursor. Everything is ordered "descending by key",
   * so `oldest` simply negates the timestamp. `most-liked` has no like model
   * yet and equals `newest` (documented in the plan).
   */
  private sortKey(row: Comment, sort: CommentSort): number {
    const stamp = row.createdAt.getTime();
    return sort === 'oldest' ? -stamp : stamp;
  }

  async list(
    sampleId: string,
    actor: Actor,
    options: ListCommentsOptions = {},
  ): Promise<CommentsPageResponse> {
    await this.access.assertCan(actor, 'sample:view', sampleId);

    const sort: CommentSort = options.sort ?? 'newest';
    const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const hash = facetHash({ sampleId, sort });
    const cursor = decodeOptionalCursor(options.cursor, hash);

    const [threads, totalCount] = await Promise.all([
      this.prisma.comment.findMany({
        where: { sampleId, parentId: null, deletedAt: null },
        include: {
          user: { select: AUTHOR_SELECT },
          replies: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            include: { user: { select: AUTHOR_SELECT } },
          },
        },
      }) as Promise<ThreadRow[]>,
      this.prisma.comment.count({ where: { sampleId, deletedAt: null } }),
    ]);

    const keyed = threads
      .map((row) => ({ k: this.sortKey(row, sort), id: row.id, row }))
      .sort((left, right) =>
        left.k !== right.k ? right.k - left.k : right.id < left.id ? -1 : 1,
      );

    const { page, nextCursor } = takePage(afterCursor(keyed, cursor), limit, hash);

    return {
      totalCount,
      comments: page.map(({ row }) => this.toDto(row, actor, row.replies)),
      nextCursor,
    };
  }

  async create(
    sampleId: string,
    actor: Actor,
    text: string,
    parentId?: string,
  ): Promise<SampleComment> {
    const sample = await this.access.assertCan(actor, 'sample:comment', sampleId);
    const author = actor as NonNullable<Actor>;
    const trimmed = text.trim();

    if (!trimmed) {
      throw new BadRequestException('Comment text is required');
    }

    let parent: Comment | null = null;

    if (parentId) {
      parent = await this.prisma.comment.findUnique({ where: { id: parentId } });

      if (!parent || parent.deletedAt || parent.sampleId !== sampleId) {
        throw new BadRequestException('Parent comment not found');
      }

      if (parent.parentId) {
        throw new BadRequestException('Replies can only be one level deep');
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.comment.create({
        data: {
          sampleId,
          userId: author.id,
          parentId: parent?.id ?? null,
          text: trimmed,
        },
        include: { user: { select: AUTHOR_SELECT } },
      });

      await tx.sample.update({
        where: { id: sampleId },
        data: { commentsCount: { increment: 1 } },
      });

      return row as CommentRow;
    });

    if (parent) {
      await this.notifications.notify({
        userId: parent.userId,
        actorId: author.id,
        type: 'COMMENT_REPLY',
        sampleId,
        commentId: created.id,
      });

      if (sample.ownerId !== parent.userId) {
        await this.notifications.notify({
          userId: sample.ownerId,
          actorId: author.id,
          type: 'COMMENT',
          sampleId,
          commentId: created.id,
        });
      }
    } else {
      await this.notifications.notify({
        userId: sample.ownerId,
        actorId: author.id,
        type: 'COMMENT',
        sampleId,
        commentId: created.id,
      });
    }

    return this.toDto(created, actor, parent ? undefined : []);
  }

  async update(commentId: string, actor: Actor, text: string): Promise<SampleComment> {
    const existing = await this.access.assertCanComment(actor, 'comment:edit', commentId);
    const trimmed = text.trim();

    if (!trimmed) {
      throw new BadRequestException('Comment text is required');
    }

    const updated = (await this.prisma.comment.update({
      where: { id: existing.id },
      data: { text: trimmed },
      include: { user: { select: AUTHOR_SELECT } },
    })) as CommentRow;

    return this.toDto(updated, actor);
  }

  /** Soft delete; replies of a deleted thread disappear with it. */
  async remove(commentId: string, actor: Actor): Promise<void> {
    const existing = await this.access.assertCanComment(actor, 'comment:delete', commentId);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      let removed = 1;

      await tx.comment.update({ where: { id: existing.id }, data: { deletedAt: now } });

      if (!existing.parentId) {
        const { count } = await tx.comment.updateMany({
          where: { parentId: existing.id, deletedAt: null },
          data: { deletedAt: now },
        });
        removed += count;
      }

      await tx.sample.update({
        where: { id: existing.sampleId },
        data: { commentsCount: { decrement: removed } },
      });
    });
  }
}
