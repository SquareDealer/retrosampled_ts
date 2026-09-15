import { Injectable } from '@nestjs/common';
import { LikeResponse } from '@retrosampled/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/types/authenticated-request';
import { NotificationsService } from '../../notifications/service/notifications.service';
import { SampleAccessService, toActor } from './sample-access.service';

/**
 * Idempotent like / unlike. The `Like` row and the `likesCount` counter change
 * in one transaction; repeating a call is a no-op that still returns the
 * current state, so an optimistic client can retry safely. The LIKE
 * notification goes through `NotificationsService.notify` (self-likes skipped).
 */
@Injectable()
export class LikesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SampleAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  async like(actor: RequestUser, sampleId: string): Promise<LikeResponse> {
    const sample = await this.access.assertCan(toActor(actor), 'sample:like', sampleId);

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.like.findUnique({
        where: { userId_sampleId: { userId: actor.id, sampleId } },
        select: { id: true },
      });

      if (existing) {
        const current = await tx.sample.findUniqueOrThrow({
          where: { id: sampleId },
          select: { likesCount: true },
        });
        return { liked: true, likesCount: current.likesCount, created: false };
      }

      await tx.like.create({ data: { userId: actor.id, sampleId } });

      const updated = await tx.sample.update({
        where: { id: sampleId },
        data: { likesCount: { increment: 1 } },
        select: { likesCount: true },
      });

      return { liked: true, likesCount: updated.likesCount, created: true };
    });

    if (result.created) {
      await this.notifications.notify({
        userId: sample.ownerId,
        actorId: actor.id,
        type: 'LIKE',
        sampleId,
        data: { sampleTitle: sample.title },
      });
    }

    return { liked: result.liked, likesCount: result.likesCount };
  }

  async unlike(actor: RequestUser, sampleId: string): Promise<LikeResponse> {
    await this.access.assertCan(toActor(actor), 'sample:like', sampleId);

    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.like.deleteMany({
        where: { userId: actor.id, sampleId },
      });

      if (deleted.count > 0) {
        await tx.sample.updateMany({
          where: { id: sampleId, likesCount: { gt: 0 } },
          data: { likesCount: { decrement: 1 } },
        });
      }

      const current = await tx.sample.findUniqueOrThrow({
        where: { id: sampleId },
        select: { likesCount: true },
      });

      return { liked: false, likesCount: current.likesCount };
    });
  }
}
