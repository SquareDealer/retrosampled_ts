import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FollowResponse } from '@retrosampled/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/service/notifications.service';

@Injectable()
export class FollowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async requireActiveUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, isActive: true, followersCount: true },
    });

    if (!user || !user.isActive) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Idempotent: following someone twice is a no-op that still reports the
   * current state. Counters move in the same transaction as the Follow row.
   */
  async follow(actorId: string, targetId: string): Promise<FollowResponse> {
    if (actorId === targetId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    await this.requireActiveUser(targetId);

    let created = false;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.follow.create({
          data: { followerId: actorId, followingId: targetId },
        });
        await tx.user.update({
          where: { id: targetId },
          data: { followersCount: { increment: 1 } },
        });
        await tx.user.update({
          where: { id: actorId },
          data: { followingCount: { increment: 1 } },
        });
      });
      created = true;
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
    }

    if (created) {
      await this.notifications.notify({
        userId: targetId,
        actorId,
        type: 'FOLLOW',
      });
    }

    const target = await this.requireActiveUser(targetId);

    return { following: true, followersCount: target.followersCount };
  }

  /** Idempotent: unfollowing someone you do not follow is a no-op. */
  async unfollow(actorId: string, targetId: string): Promise<FollowResponse> {
    if (actorId === targetId) {
      throw new BadRequestException('You cannot unfollow yourself');
    }

    await this.requireActiveUser(targetId);

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.follow.deleteMany({
        where: { followerId: actorId, followingId: targetId },
      });

      if (count === 0) {
        return;
      }

      await tx.user.update({
        where: { id: targetId },
        data: { followersCount: { decrement: 1 } },
      });
      await tx.user.update({
        where: { id: actorId },
        data: { followingCount: { decrement: 1 } },
      });
    });

    const target = await this.requireActiveUser(targetId);

    return { following: false, followersCount: Math.max(0, target.followersCount) };
  }

  async isFollowing(actorId: string | undefined, targetId: string): Promise<boolean> {
    if (!actorId) {
      return false;
    }

    const row = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: actorId, followingId: targetId } },
      select: { id: true },
    });

    return row !== null;
  }
}
