import { Injectable } from '@nestjs/common';
import { LikeResponse } from '@retrosampled/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/types/authenticated-request';
import { SampleAccessService, toActor } from './sample-access.service';

/**
 * Idempotent like / unlike. The `Like` row and the `likesCount` counter change
 * in one transaction; repeating a call is a no-op that still returns the
 * current state, so an optimistic client can retry safely.
 */
@Injectable()
export class LikesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SampleAccessService,
  ) {}

  async like(actor: RequestUser, sampleId: string): Promise<LikeResponse> {
    const sample = await this.access.assertCan(toActor(actor), 'sample:like', sampleId);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.like.findUnique({
        where: { userId_sampleId: { userId: actor.id, sampleId } },
        select: { id: true },
      });

      if (existing) {
        const current = await tx.sample.findUniqueOrThrow({
          where: { id: sampleId },
          select: { likesCount: true },
        });
        return { liked: true, likesCount: current.likesCount };
      }

      await tx.like.create({ data: { userId: actor.id, sampleId } });

      const updated = await tx.sample.update({
        where: { id: sampleId },
        data: { likesCount: { increment: 1 } },
        select: { likesCount: true },
      });

      if (sample.ownerId !== actor.id) {
        await tx.notification.create({
          data: {
            userId: sample.ownerId,
            actorId: actor.id,
            type: 'LIKE',
            sampleId,
            data: JSON.stringify({ sampleTitle: sample.title }),
          },
        });
      }

      return { liked: true, likesCount: updated.likesCount };
    });
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
