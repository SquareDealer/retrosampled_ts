import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Actor, SampleStatus } from '@retrosampled/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/types/authenticated-request';
import { SampleAccessService, toActor } from './sample-access.service';

const OWNER_ID = 'owner-1';
const OTHER_ID = 'other-1';
const ADMIN_ID = 'admin-1';
const COLLAB_ID = 'collab-1';

const GUEST: Actor = null;
const OWNER: Actor = { id: OWNER_ID, role: 'USER' };
const OTHER: Actor = { id: OTHER_ID, role: 'USER' };
const ADMIN: Actor = { id: ADMIN_ID, role: 'ADMIN' };
const COLLABORATOR: Actor = { id: COLLAB_ID, role: 'USER' };

type SampleRow = {
  id: string;
  ownerId: string;
  status: SampleStatus;
  collaborators: Array<{ userId: string }>;
};

function sampleRow(status: SampleStatus, overrides: Partial<SampleRow> = {}) {
  return {
    id: 'sample-1',
    ownerId: OWNER_ID,
    parentId: null,
    rootId: 'sample-1',
    depth: 0,
    title: 'Dusty loop',
    description: null,
    status,
    audioKey: 'samples/sample-1/audio.wav',
    audioMime: 'audio/wav',
    audioSizeBytes: 1024,
    coverKey: null,
    peaksKey: null,
    durationSec: 12,
    bpm: 90,
    musicalKey: 'Am',
    sampleType: null,
    processingError: null,
    likesCount: 0,
    downloadsCount: 0,
    playsCount: 0,
    remakesCount: 0,
    commentsCount: 0,
    publishedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    collaborators: [{ userId: COLLAB_ID }],
    ...overrides,
  };
}

function commentRow(
  overrides: { userId?: string; deletedAt?: Date | null; sampleStatus?: SampleStatus } = {},
) {
  return {
    id: 'comment-1',
    sampleId: 'sample-1',
    userId: overrides.userId ?? OTHER_ID,
    parentId: null,
    text: 'heat',
    deletedAt: overrides.deletedAt ?? null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    sample: sampleRow(overrides.sampleStatus ?? 'PUBLISHED'),
  };
}

function createService() {
  const prisma = {
    sample: { findUnique: jest.fn() },
    comment: { findUnique: jest.fn() },
  };

  return {
    prisma,
    service: new SampleAccessService(prisma as unknown as PrismaService),
  };
}

describe('toActor', () => {
  it('maps req.user onto the can() actor shape', () => {
    const user: RequestUser = {
      sub: OWNER_ID,
      id: OWNER_ID,
      email: 'owner@example.com',
      username: 'owner',
      role: 'USER',
    };

    expect(toActor(user)).toEqual({ id: OWNER_ID, role: 'USER' });
  });

  it('treats a missing user as a guest', () => {
    expect(toActor(undefined)).toBeNull();
    expect(toActor(null)).toBeNull();
  });
});

describe('SampleAccessService', () => {
  describe('loadSample', () => {
    it('flattens the collaborator ids and queries once', async () => {
      const { prisma, service } = createService();
      prisma.sample.findUnique.mockResolvedValue(sampleRow('PUBLISHED'));

      const sample = await service.loadSample('sample-1');

      expect(sample.collaboratorIds).toEqual([COLLAB_ID]);
      expect(prisma.sample.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.sample.findUnique).toHaveBeenCalledWith({
        where: { id: 'sample-1' },
        include: { collaborators: { select: { userId: true } } },
      });
    });

    it('throws 404 for a missing row', async () => {
      const { prisma, service } = createService();
      prisma.sample.findUnique.mockResolvedValue(null);

      await expect(service.loadSample('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('assertCan — published sample', () => {
    it('lets a guest view it', async () => {
      const { prisma, service } = createService();
      prisma.sample.findUnique.mockResolvedValue(sampleRow('PUBLISHED'));

      await expect(
        service.assertCan(GUEST, 'sample:view', 'sample-1'),
      ).resolves.toMatchObject({ id: 'sample-1' });
    });

    it('answers 401 when a guest tries to download it', async () => {
      const { prisma, service } = createService();
      prisma.sample.findUnique.mockResolvedValue(sampleRow('PUBLISHED'));

      await expect(
        service.assertCan(GUEST, 'sample:download', 'sample-1'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('answers 403 when a signed-in stranger tries to edit it', async () => {
      const { prisma, service } = createService();
      prisma.sample.findUnique.mockResolvedValue(sampleRow('PUBLISHED'));

      await expect(
        service.assertCan(OTHER, 'sample:edit', 'sample-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets the owner edit and delete it', async () => {
      const { prisma, service } = createService();
      prisma.sample.findUnique.mockResolvedValue(sampleRow('PUBLISHED'));

      await expect(
        service.assertCan(OWNER, 'sample:edit', 'sample-1'),
      ).resolves.toBeDefined();
      await expect(
        service.assertCan(OWNER, 'sample:delete', 'sample-1'),
      ).resolves.toBeDefined();
    });

    it('lets an admin delete it', async () => {
      const { prisma, service } = createService();
      prisma.sample.findUnique.mockResolvedValue(sampleRow('PUBLISHED'));

      await expect(
        service.assertCan(ADMIN, 'sample:delete', 'sample-1'),
      ).resolves.toBeDefined();
    });
  });

  describe('assertCan — hidden sample', () => {
    for (const status of ['DRAFT', 'PRIVATE', 'PROCESSING', 'FAILED'] as SampleStatus[]) {
      it(`${status}: a guest gets 404, not 401`, async () => {
        const { prisma, service } = createService();
        prisma.sample.findUnique.mockResolvedValue(sampleRow(status));

        await expect(
          service.assertCan(GUEST, 'sample:view', 'sample-1'),
        ).rejects.toBeInstanceOf(NotFoundException);
      });

      it(`${status}: a non-owner gets 404 even for a mutating action`, async () => {
        const { prisma, service } = createService();
        prisma.sample.findUnique.mockResolvedValue(sampleRow(status));

        await expect(
          service.assertCan(OTHER, 'sample:edit', 'sample-1'),
        ).rejects.toBeInstanceOf(NotFoundException);
      });

      it(`${status}: the owner sees it`, async () => {
        const { prisma, service } = createService();
        prisma.sample.findUnique.mockResolvedValue(sampleRow(status));

        await expect(
          service.assertCan(OWNER, 'sample:view', 'sample-1'),
        ).resolves.toBeDefined();
      });

      it(`${status}: an admin sees it`, async () => {
        const { prisma, service } = createService();
        prisma.sample.findUnique.mockResolvedValue(sampleRow(status));

        await expect(
          service.assertCan(ADMIN, 'sample:view', 'sample-1'),
        ).resolves.toBeDefined();
      });
    }

    it('lets a credited collaborator view a draft but not edit it', async () => {
      const { prisma, service } = createService();
      prisma.sample.findUnique.mockResolvedValue(sampleRow('DRAFT'));

      await expect(
        service.assertCan(COLLABORATOR, 'sample:view', 'sample-1'),
      ).resolves.toBeDefined();
      await expect(
        service.assertCan(COLLABORATOR, 'sample:edit', 'sample-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('check', () => {
    it('returns booleans instead of throwing', async () => {
      const { prisma, service } = createService();
      prisma.sample.findUnique.mockResolvedValue(sampleRow('DRAFT'));

      await expect(service.check(OWNER, 'sample:edit', 'sample-1')).resolves.toBe(true);
      await expect(service.check(OTHER, 'sample:edit', 'sample-1')).resolves.toBe(false);
      await expect(service.check(GUEST, 'sample:view', 'sample-1')).resolves.toBe(false);
    });

    it('returns false for a missing sample', async () => {
      const { prisma, service } = createService();
      prisma.sample.findUnique.mockResolvedValue(null);

      await expect(service.check(ADMIN, 'sample:view', 'gone')).resolves.toBe(false);
    });
  });

  describe('assertCanComment', () => {
    it('lets the author edit their own comment', async () => {
      const { prisma, service } = createService();
      prisma.comment.findUnique.mockResolvedValue(commentRow({ userId: OTHER_ID }));

      await expect(
        service.assertCanComment(OTHER, 'comment:edit', 'comment-1'),
      ).resolves.toMatchObject({ id: 'comment-1' });
    });

    it('refuses the sample owner editing someone else`s comment', async () => {
      const { prisma, service } = createService();
      prisma.comment.findUnique.mockResolvedValue(commentRow({ userId: OTHER_ID }));

      await expect(
        service.assertCanComment(OWNER, 'comment:edit', 'comment-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets the sample owner delete someone else`s comment', async () => {
      const { prisma, service } = createService();
      prisma.comment.findUnique.mockResolvedValue(commentRow({ userId: OTHER_ID }));

      await expect(
        service.assertCanComment(OWNER, 'comment:delete', 'comment-1'),
      ).resolves.toBeDefined();
    });

    it('lets an admin delete any comment', async () => {
      const { prisma, service } = createService();
      prisma.comment.findUnique.mockResolvedValue(commentRow({ userId: OTHER_ID }));

      await expect(
        service.assertCanComment(ADMIN, 'comment:delete', 'comment-1'),
      ).resolves.toBeDefined();
    });

    it('refuses an unrelated user', async () => {
      const { prisma, service } = createService();
      prisma.comment.findUnique.mockResolvedValue(commentRow({ userId: OWNER_ID }));

      await expect(
        service.assertCanComment(OTHER, 'comment:delete', 'comment-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('answers 401 for a guest', async () => {
      const { prisma, service } = createService();
      prisma.comment.findUnique.mockResolvedValue(commentRow());

      await expect(
        service.assertCanComment(GUEST, 'comment:delete', 'comment-1'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('treats a soft-deleted comment as gone', async () => {
      const { prisma, service } = createService();
      prisma.comment.findUnique.mockResolvedValue(
        commentRow({ deletedAt: new Date() }),
      );

      await expect(
        service.assertCanComment(ADMIN, 'comment:delete', 'comment-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('treats a comment on an invisible sample as gone', async () => {
      const { prisma, service } = createService();
      prisma.comment.findUnique.mockResolvedValue(
        commentRow({ userId: OTHER_ID, sampleStatus: 'PRIVATE' }),
      );

      await expect(
        service.assertCanComment(OTHER, 'comment:delete', 'comment-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 404 for a missing comment', async () => {
      const { prisma, service } = createService();
      prisma.comment.findUnique.mockResolvedValue(null);

      await expect(
        service.assertCanComment(ADMIN, 'comment:delete', 'nope'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
