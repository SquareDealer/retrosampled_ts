import { BadRequestException } from '@nestjs/common';
import { Comment } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/service/notifications.service';
import { SampleAccessService } from './sample-access.service';
import { CommentsService } from './comments.service';

type Author = { id: string; username: string; avatarKey: string | null };

const AUTHORS: Record<string, Author> = {
  owner: { id: 'owner', username: 'southkid', avatarKey: null },
  alice: { id: 'alice', username: 'alice', avatarKey: 'avatars/alice.png' },
  bob: { id: 'bob', username: 'bob', avatarKey: null },
};

function makeComment(overrides: Partial<Comment> & { id: string; userId: string }): Comment {
  return {
    sampleId: 's-1',
    parentId: null,
    text: `text ${overrides.id}`,
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createPrismaMock(comments: Comment[]) {
  const counters = { commentsCount: comments.length };
  const withUser = (row: Comment) => ({ ...row, user: AUTHORS[row.userId] });

  const client = {
    comment: {
      findMany: jest.fn(
        async ({ where, include }: { where: { sampleId: string }; include?: { replies?: unknown } }) => {
          return comments
            .filter((row) => row.sampleId === where.sampleId && !row.parentId && !row.deletedAt)
            .map((row) => ({
              ...withUser(row),
              ...(include?.replies
                ? {
                    replies: comments
                      .filter((reply) => reply.parentId === row.id && !reply.deletedAt)
                      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
                      .map(withUser),
                  }
                : {}),
            }));
        },
      ),
      count: jest.fn(async ({ where }: { where: { sampleId: string } }) => {
        return comments.filter((row) => row.sampleId === where.sampleId && !row.deletedAt).length;
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return comments.find((row) => row.id === where.id) ?? null;
      }),
      create: jest.fn(async ({ data }: { data: Partial<Comment> }) => {
        const row = makeComment({
          id: `c-${comments.length + 1}`,
          userId: data.userId as string,
          ...data,
          createdAt: new Date(),
        });
        comments.push(row);
        return withUser(row);
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<Comment> }) => {
        const row = comments.find((item) => item.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return withUser(row);
      }),
      updateMany: jest.fn(
        async ({ where, data }: { where: { parentId: string }; data: Partial<Comment> }) => {
          let count = 0;
          for (const row of comments) {
            if (row.parentId === where.parentId && !row.deletedAt) {
              Object.assign(row, data);
              count += 1;
            }
          }
          return { count };
        },
      ),
    },
    sample: {
      update: jest.fn(
        async ({ data }: { data: { commentsCount: { increment?: number; decrement?: number } } }) => {
          counters.commentsCount += data.commentsCount.increment ?? 0;
          counters.commentsCount -= data.commentsCount.decrement ?? 0;
          return counters;
        },
      ),
    },
  };

  return {
    comments,
    counters,
    ...client,
    $transaction: jest.fn(async (callback: (tx: typeof client) => Promise<unknown>) => callback(client)),
  };
}

function createAccessMock(comments: Comment[]) {
  const sampleRow = { id: 's-1', ownerId: 'owner', status: 'PUBLISHED', collaboratorIds: [] };

  return {
    assertCan: jest.fn(async () => sampleRow),
    assertCanComment: jest.fn(async (_actor: unknown, _action: string, id: string) => {
      const row = comments.find((item) => item.id === id);
      if (!row) throw new Error('not found');
      return { ...row, sample: sampleRow };
    }),
  };
}

describe('CommentsService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let access: ReturnType<typeof createAccessMock>;
  let notifications: { notify: jest.Mock };
  let service: CommentsService;

  const alice = { id: 'alice', role: 'USER' as const };

  const build = (rows: Comment[] = []) => {
    prisma = createPrismaMock(rows);
    access = createAccessMock(rows);
    notifications = { notify: jest.fn(async () => null) };
    service = new CommentsService(
      prisma as unknown as PrismaService,
      access as unknown as SampleAccessService,
      notifications as unknown as NotificationsService,
    );
  };

  const seed = () => [
    makeComment({ id: 'c-1', userId: 'alice', createdAt: new Date('2026-01-01T00:00:00Z') }),
    makeComment({ id: 'c-2', userId: 'bob', createdAt: new Date('2026-01-02T00:00:00Z') }),
    makeComment({
      id: 'c-3',
      userId: 'owner',
      parentId: 'c-1',
      createdAt: new Date('2026-01-03T00:00:00Z'),
    }),
  ];

  beforeEach(() => build(seed()));

  describe('list', () => {
    it('returns threads newest first with nested replies and isOwner flags', async () => {
      const response = await service.list('s-1', alice);

      expect(access.assertCan).toHaveBeenCalledWith(alice, 'sample:view', 's-1');
      expect(response.totalCount).toBe(3);
      expect(response.comments.map((comment) => comment.id)).toEqual(['c-2', 'c-1']);
      expect(response.comments[1].isOwner).toBe(true);
      expect(response.comments[0].isOwner).toBe(false);
      expect(response.comments[1].replies?.map((reply) => reply.id)).toEqual(['c-3']);
      expect(response.comments[1].replies?.[0].parentId).toBe('c-1');
      expect(response.comments[1].user.avatarUrl).toMatch(/\/uploads\/avatars\/alice\.png$/);
      expect(response.nextCursor).toBeNull();
    });

    it('supports oldest first and pages with a cursor', async () => {
      const first = await service.list('s-1', null, { sort: 'oldest', limit: 1 });
      expect(first.comments.map((comment) => comment.id)).toEqual(['c-1']);
      expect(first.nextCursor).not.toBeNull();

      const second = await service.list('s-1', null, {
        sort: 'oldest',
        limit: 1,
        cursor: first.nextCursor as string,
      });
      expect(second.comments.map((comment) => comment.id)).toEqual(['c-2']);
      expect(second.nextCursor).toBeNull();

      await expect(
        service.list('s-1', null, { sort: 'newest', limit: 1, cursor: first.nextCursor as string }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('hides soft-deleted threads', async () => {
      prisma.comments[1].deletedAt = new Date();

      const response = await service.list('s-1', null);

      expect(response.comments.map((comment) => comment.id)).toEqual(['c-1']);
      expect(response.totalCount).toBe(2);
    });
  });

  describe('create', () => {
    it('creates a top-level comment, bumps the counter and notifies the owner', async () => {
      const created = await service.create('s-1', alice, '  hello  ');

      expect(access.assertCan).toHaveBeenCalledWith(alice, 'sample:comment', 's-1');
      expect(created.text).toBe('hello');
      expect(created.isOwner).toBe(true);
      expect(created.replies).toEqual([]);
      expect(prisma.counters.commentsCount).toBe(4);
      expect(notifications.notify).toHaveBeenCalledWith({
        userId: 'owner',
        actorId: 'alice',
        type: 'COMMENT',
        sampleId: 's-1',
        commentId: created.id,
      });
    });

    it('creates a reply and notifies the parent author (and the owner once)', async () => {
      const bob = { id: 'bob', role: 'USER' as const };
      const created = await service.create('s-1', bob, 'reply', 'c-1');

      expect(created.parentId).toBe('c-1');
      expect(created.replies).toBeUndefined();
      expect(notifications.notify).toHaveBeenCalledTimes(2);
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'alice', actorId: 'bob', type: 'COMMENT_REPLY' }),
      );
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'owner', actorId: 'bob', type: 'COMMENT' }),
      );
    });

    it('rejects nesting deeper than one level and unknown parents', async () => {
      await expect(service.create('s-1', alice, 'x', 'c-3')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.create('s-1', alice, 'x', 'nope')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.create('s-1', alice, '   ')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update / remove', () => {
    it('rewrites the text through the access check', async () => {
      const updated = await service.update('c-1', alice, 'edited');

      expect(access.assertCanComment).toHaveBeenCalledWith(alice, 'comment:edit', 'c-1');
      expect(updated.text).toBe('edited');
    });

    it('soft-deletes a thread with its replies and fixes the counter', async () => {
      await service.remove('c-1', alice);

      expect(access.assertCanComment).toHaveBeenCalledWith(alice, 'comment:delete', 'c-1');
      expect(prisma.comments.find((row) => row.id === 'c-1')?.deletedAt).not.toBeNull();
      expect(prisma.comments.find((row) => row.id === 'c-3')?.deletedAt).not.toBeNull();
      expect(prisma.counters.commentsCount).toBe(1);
    });

    it('soft-deletes a single reply', async () => {
      await service.remove('c-3', { id: 'owner', role: 'USER' });

      expect(prisma.comments.find((row) => row.id === 'c-1')?.deletedAt).toBeNull();
      expect(prisma.counters.commentsCount).toBe(2);
    });
  });
});
