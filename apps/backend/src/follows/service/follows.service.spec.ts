import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/service/notifications.service';
import { FollowsService } from './follows.service';

type UserRow = {
  id: string;
  isActive: boolean;
  followersCount: number;
  followingCount: number;
};

type FollowRow = { id: string; followerId: string; followingId: string };

function createPrismaMock(users: UserRow[], follows: FollowRow[] = []) {
  const user = {
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
      return users.find((row) => row.id === where.id) ?? null;
    }),
    update: jest.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: {
          followersCount?: { increment?: number; decrement?: number };
          followingCount?: { increment?: number; decrement?: number };
        };
      }) => {
        const row = users.find((item) => item.id === where.id);
        if (!row) throw new Error('not found');
        for (const key of ['followersCount', 'followingCount'] as const) {
          const change = data[key];
          if (change?.increment) row[key] += change.increment;
          if (change?.decrement) row[key] -= change.decrement;
        }
        return row;
      },
    ),
  };

  const follow = {
    create: jest.fn(async ({ data }: { data: Omit<FollowRow, 'id'> }) => {
      const exists = follows.some(
        (row) => row.followerId === data.followerId && row.followingId === data.followingId,
      );
      if (exists) {
        throw new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'test',
        });
      }
      const row = { id: `f-${follows.length + 1}`, ...data };
      follows.push(row);
      return row;
    }),
    deleteMany: jest.fn(async ({ where }: { where: Omit<FollowRow, 'id'> }) => {
      const before = follows.length;
      for (let index = follows.length - 1; index >= 0; index -= 1) {
        const row = follows[index];
        if (row.followerId === where.followerId && row.followingId === where.followingId) {
          follows.splice(index, 1);
        }
      }
      return { count: before - follows.length };
    }),
    findUnique: jest.fn(
      async ({
        where,
      }: {
        where: { followerId_followingId: Omit<FollowRow, 'id'> };
      }) => {
        const key = where.followerId_followingId;
        return (
          follows.find(
            (row) => row.followerId === key.followerId && row.followingId === key.followingId,
          ) ?? null
        );
      },
    ),
  };

  const client = { user, follow };

  return {
    users,
    follows,
    ...client,
    $transaction: jest.fn(async (callback: (tx: typeof client) => Promise<void>) => {
      return callback(client);
    }),
  };
}

describe('FollowsService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let notifications: { notify: jest.Mock };
  let service: FollowsService;

  const build = (users: UserRow[], follows: FollowRow[] = []) => {
    prisma = createPrismaMock(users, follows);
    notifications = { notify: jest.fn(async () => null) };
    service = new FollowsService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );
  };

  const alice = (): UserRow => ({ id: 'alice', isActive: true, followersCount: 0, followingCount: 0 });
  const bob = (): UserRow => ({ id: 'bob', isActive: true, followersCount: 3, followingCount: 1 });

  beforeEach(() => build([alice(), bob()]));

  it('creates the follow, moves both counters and notifies the target', async () => {
    const response = await service.follow('alice', 'bob');

    expect(response).toEqual({ following: true, followersCount: 4 });
    expect(prisma.users.find((row) => row.id === 'alice')?.followingCount).toBe(1);
    expect(prisma.follows).toHaveLength(1);
    expect(notifications.notify).toHaveBeenCalledWith({
      userId: 'bob',
      actorId: 'alice',
      type: 'FOLLOW',
    });
  });

  it('is idempotent: a second follow does not bump counters or notify again', async () => {
    await service.follow('alice', 'bob');
    notifications.notify.mockClear();

    const response = await service.follow('alice', 'bob');

    expect(response).toEqual({ following: true, followersCount: 4 });
    expect(prisma.follows).toHaveLength(1);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('rejects following yourself', async () => {
    await expect(service.follow('alice', 'alice')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.unfollow('alice', 'alice')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s on an unknown or deactivated target', async () => {
    build([alice(), { ...bob(), isActive: false }]);

    await expect(service.follow('alice', 'bob')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.follow('alice', 'nobody')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('unfollow removes the row and decrements; repeating it is a no-op', async () => {
    await service.follow('alice', 'bob');

    const first = await service.unfollow('alice', 'bob');
    expect(first).toEqual({ following: false, followersCount: 3 });
    expect(prisma.users.find((row) => row.id === 'alice')?.followingCount).toBe(0);

    const second = await service.unfollow('alice', 'bob');
    expect(second).toEqual({ following: false, followersCount: 3 });
  });

  it('answers isFollowing from the Follow table (guests never follow)', async () => {
    expect(await service.isFollowing(undefined, 'bob')).toBe(false);
    expect(await service.isFollowing('alice', 'bob')).toBe(false);

    await service.follow('alice', 'bob');

    expect(await service.isFollowing('alice', 'bob')).toBe(true);
  });
});
