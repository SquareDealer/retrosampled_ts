import { BadRequestException } from '@nestjs/common';
import { Notification } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

type Row = Notification & {
  actor: { id: string; username: string; avatarKey: string | null } | null;
  sample: { id: string; title: string } | null;
};

function makeRow(overrides: Partial<Row> = {}): Row {
  return {
    id: 'n-1',
    userId: 'u-1',
    actorId: 'u-2',
    type: 'FOLLOW',
    sampleId: null,
    commentId: null,
    data: '{}',
    readAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    actor: { id: 'u-2', username: 'bagamemphis', avatarKey: null },
    sample: null,
    ...overrides,
  };
}

function createPrismaMock(rows: Row[] = []) {
  return {
    rows,
    notification: {
      create: jest.fn(async ({ data }: { data: Partial<Notification> }) => {
        const row = makeRow({ id: `n-${rows.length + 1}`, ...data } as Partial<Row>);
        rows.push(row);
        return row;
      }),
      count: jest.fn(async ({ where }: { where: { userId: string; readAt?: null } }) => {
        return rows.filter(
          (row) => row.userId === where.userId && (where.readAt === undefined || row.readAt === null),
        ).length;
      }),
      findMany: jest.fn(async ({ take }: { take: number }) => rows.slice(0, take)),
      updateMany: jest.fn(async ({ where }: { where: { id?: string; userId: string } }) => {
        let count = 0;
        for (const row of rows) {
          if (row.userId === where.userId && (!where.id || row.id === where.id) && !row.readAt) {
            row.readAt = new Date();
            count += 1;
          }
        }
        return { count };
      }),
    },
  };
}

const storage = { publicUrl: (key: string) => `http://storage.test/uploads/${key}` };

describe('NotificationsService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: NotificationsService;

  const build = (rows: Row[] = []) => {
    prisma = createPrismaMock(rows);
    service = new NotificationsService(prisma as unknown as PrismaService, storage as never);
  };

  beforeEach(() => build());

  describe('notify', () => {
    it('stores the notification with a serialized payload', async () => {
      const created = await service.notify({
        userId: 'u-1',
        actorId: 'u-2',
        type: 'LIKE',
        sampleId: 's-1',
        data: { note: 'x' },
      });

      expect(created).not.toBeNull();
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'u-1',
          actorId: 'u-2',
          type: 'LIKE',
          sampleId: 's-1',
          commentId: null,
          data: '{"note":"x"}',
        },
      });
    });

    it('never notifies the actor about their own action', async () => {
      const created = await service.notify({ userId: 'u-1', actorId: 'u-1', type: 'FOLLOW' });

      expect(created).toBeNull();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('allows system notifications without an actor', async () => {
      await service.notify({ userId: 'u-1', actorId: null, type: 'SYSTEM', data: { href: '/feed' } });

      expect(prisma.notification.create).toHaveBeenCalled();
    });
  });

  describe('href', () => {
    it('links FOLLOW to the actor profile', () => {
      expect(service.hrefFor(makeRow())).toBe('/user/bagamemphis');
    });

    it('links sample notifications to the sample page', () => {
      for (const type of ['LIKE', 'COMMENT', 'COMMENT_REPLY', 'REMAKE']) {
        expect(service.hrefFor(makeRow({ type, sampleId: 's-9' }))).toBe('/sample/s-9');
      }
    });

    it('honours an explicit href in the payload', () => {
      expect(service.hrefFor(makeRow({ type: 'SYSTEM', data: '{"href":"/settings"}' }))).toBe(
        '/settings',
      );
      expect(service.hrefFor(makeRow({ type: 'SYSTEM', data: '{"href":"http://evil"}' }))).toBe(
        '/feed',
      );
    });
  });

  describe('list', () => {
    it('maps rows and reports the unread count', async () => {
      build([makeRow(), makeRow({ id: 'n-2', readAt: new Date() })]);

      const response = await service.list('u-1', {});

      expect(response.items).toHaveLength(2);
      expect(response.items[0]).toMatchObject({
        id: 'n-1',
        type: 'FOLLOW',
        read: false,
        href: '/user/bagamemphis',
        actor: { username: 'bagamemphis', avatarUrl: null },
      });
      expect(response.items[1].read).toBe(true);
      expect(response.unreadCount).toBe(1);
      expect(response.nextCursor).toBeNull();
    });

    it('emits a cursor when more rows exist and rejects it under other facets', async () => {
      build([makeRow(), makeRow({ id: 'n-2' }), makeRow({ id: 'n-3' })]);

      const response = await service.list('u-1', { limit: 2 });

      expect(response.items).toHaveLength(2);
      expect(response.nextCursor).not.toBeNull();

      await expect(
        service.list('u-1', { limit: 2, unreadOnly: true, cursor: response.nextCursor as string }),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.list('u-1', { limit: 2, cursor: response.nextCursor as string }),
      ).resolves.toBeDefined();
    });
  });

  describe('mark read', () => {
    it('marks a single row and returns the new unread count', async () => {
      build([makeRow(), makeRow({ id: 'n-2' })]);

      const response = await service.markRead('u-1', 'n-1');

      expect(response.unreadCount).toBe(1);
      expect(prisma.rows[0].readAt).not.toBeNull();
    });

    it('marks everything read', async () => {
      build([makeRow(), makeRow({ id: 'n-2' })]);

      const response = await service.markAllRead('u-1');

      expect(response.unreadCount).toBe(0);
      expect(prisma.rows.every((row) => row.readAt !== null)).toBe(true);
    });
  });
});
