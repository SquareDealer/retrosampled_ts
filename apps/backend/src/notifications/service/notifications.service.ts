import { Inject, Injectable } from '@nestjs/common';
import { Notification, Prisma } from '@prisma/client';
import {
  NotificationDto,
  NotificationType,
  NotificationsResponse,
  UnreadCountResponse,
} from '@retrosampled/shared';
import { PrismaService } from '../../prisma/prisma.service';
import {
  decodeOptionalCursor,
  encodeCursor,
  facetHash,
} from '../../common/pagination/cursor';
import { publicUrlOrNull } from '../../storage/public-url';
import { STORAGE, StoragePort } from '../../storage/storage.port';

/**
 * Input for {@link NotificationsService.notify}. Task 3.1a's samples module
 * calls it for LIKE / REMAKE, the follows and comments services for the rest.
 */
export type NotifyInput = {
  /** Recipient. */
  userId: string;
  /** Who triggered it; `null` for SYSTEM notifications. */
  actorId: string | null;
  type: NotificationType;
  sampleId?: string | null;
  commentId?: string | null;
  /** Free-form payload; `href` here overrides the computed link (SYSTEM). */
  data?: Record<string, unknown>;
};

type NotificationRow = Notification & {
  actor: { id: string; username: string; avatarKey: string | null } | null;
  sample: { id: string; title: string } | null;
};

export type ListNotificationsQuery = {
  cursor?: string;
  limit?: number;
  unreadOnly?: boolean;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  /**
   * Creates a notification. A user never gets notified about their own action
   * (`actorId === userId` is silently skipped) so callers do not need to guard.
   * Returns the created row, or `null` when skipped.
   */
  async notify(input: NotifyInput): Promise<Notification | null> {
    if (input.actorId !== null && input.actorId === input.userId) {
      return null;
    }

    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        actorId: input.actorId,
        type: input.type,
        sampleId: input.sampleId ?? null,
        commentId: input.commentId ?? null,
        data: JSON.stringify(input.data ?? {}),
      },
    });
  }

  private parseData(raw: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  /** Where the UI navigates on click, derived from the type. */
  hrefFor(row: NotificationRow): string {
    const data = this.parseData(row.data);
    if (typeof data.href === 'string' && data.href.startsWith('/')) {
      return data.href;
    }

    switch (row.type as NotificationType) {
      case 'FOLLOW':
        return row.actor ? `/user/${row.actor.username}` : '/feed';
      case 'LIKE':
      case 'COMMENT':
      case 'COMMENT_REPLY':
      case 'REMAKE':
        return row.sampleId ? `/sample/${row.sampleId}` : '/feed';
      case 'SYSTEM':
      default:
        return '/feed';
    }
  }

  toDto(row: NotificationRow): NotificationDto {
    return {
      id: row.id,
      type: row.type as NotificationType,
      actor: row.actor
        ? {
            id: row.actor.id,
            username: row.actor.username,
            avatarUrl: publicUrlOrNull(this.storage, row.actor.avatarKey),
          }
        : null,
      sample: row.sample ? { id: row.sample.id, title: row.sample.title } : null,
      commentId: row.commentId,
      read: row.readAt !== null,
      createdAt: row.createdAt.toISOString(),
      href: this.hrefFor(row),
    };
  }

  async unreadCount(userId: string): Promise<UnreadCountResponse> {
    const unreadCount = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });

    return { unreadCount };
  }

  async list(
    userId: string,
    query: ListNotificationsQuery,
  ): Promise<NotificationsResponse> {
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const unreadOnly = query.unreadOnly ?? false;
    const hash = facetHash({ userId, unreadOnly });
    const cursor = decodeOptionalCursor(query.cursor, hash);

    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    if (cursor) {
      const createdAt = new Date(Number(cursor.k));
      where.OR = [
        { createdAt: { lt: createdAt } },
        { createdAt, id: { lt: cursor.id } },
      ];
    }

    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        actor: { select: { id: true, username: true, avatarKey: true } },
        sample: { select: { id: true, title: true } },
      },
    });

    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    const nextCursor =
      rows.length > limit && last
        ? encodeCursor({ k: last.createdAt.getTime(), id: last.id }, hash)
        : null;

    const { unreadCount } = await this.unreadCount(userId);

    return {
      items: page.map((row) => this.toDto(row)),
      unreadCount,
      nextCursor,
    };
  }

  /** Marks one notification read. Unknown ids and other users' rows are a no-op. */
  async markRead(userId: string, id: string): Promise<UnreadCountResponse> {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });

    return this.unreadCount(userId);
  }

  async markAllRead(userId: string): Promise<UnreadCountResponse> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    return { unreadCount: 0 };
  }
}
