import { LikesService } from './likes.service';

const USER = { sub: 'u1', id: 'u1', email: 'u1@example.com', username: 'u1', role: 'USER' as const };

function buildService(initialLikesCount: number, alreadyLiked: boolean, ownerId = 'owner') {
  let likesCount = initialLikesCount;
  let liked = alreadyLiked;

  const tx = {
    like: {
      findUnique: jest.fn(async () => (liked ? { id: 'like-1' } : null)),
      create: jest.fn(async () => {
        liked = true;
        return { id: 'like-1' };
      }),
      deleteMany: jest.fn(async () => {
        const count = liked ? 1 : 0;
        liked = false;
        return { count };
      }),
    },
    sample: {
      findUniqueOrThrow: jest.fn(async () => ({ likesCount })),
      update: jest.fn(async () => {
        likesCount += 1;
        return { likesCount };
      }),
      updateMany: jest.fn(async () => {
        likesCount = Math.max(0, likesCount - 1);
        return { count: 1 };
      }),
    },
    notification: { create: jest.fn(async () => ({})) },
  };

  const prisma = { $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
  const access = {
    assertCan: jest.fn(async () => ({ id: 's1', ownerId, title: 'Sample', status: 'PUBLISHED' })),
  };

  return { service: new LikesService(prisma as never, access as never), tx, access };
}

describe('LikesService', () => {
  it('like creates the row, bumps the counter and notifies the owner', async () => {
    const { service, tx } = buildService(4, false);

    await expect(service.like(USER, 's1')).resolves.toEqual({ liked: true, likesCount: 5 });
    expect(tx.like.create).toHaveBeenCalledTimes(1);
    expect(tx.sample.update).toHaveBeenCalledTimes(1);
    expect(tx.notification.create).toHaveBeenCalledTimes(1);
  });

  it('like is idempotent: a second call changes nothing', async () => {
    const { service, tx } = buildService(4, true);

    await expect(service.like(USER, 's1')).resolves.toEqual({ liked: true, likesCount: 4 });
    expect(tx.like.create).not.toHaveBeenCalled();
    expect(tx.sample.update).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it('does not notify yourself', async () => {
    const { service, tx } = buildService(0, false, USER.id);

    await service.like(USER, 's1');
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it('unlike removes the row and decrements once; repeating is a no-op', async () => {
    const { service, tx } = buildService(5, true);

    await expect(service.unlike(USER, 's1')).resolves.toEqual({ liked: false, likesCount: 4 });
    await expect(service.unlike(USER, 's1')).resolves.toEqual({ liked: false, likesCount: 4 });
    expect(tx.sample.updateMany).toHaveBeenCalledTimes(1);
  });

  it('checks sample:like access before touching anything', async () => {
    const { service, access, tx } = buildService(0, false);
    access.assertCan.mockRejectedValueOnce(new Error('nope'));

    await expect(service.like(USER, 's1')).rejects.toThrow('nope');
    expect(tx.like.create).not.toHaveBeenCalled();
  });
});
