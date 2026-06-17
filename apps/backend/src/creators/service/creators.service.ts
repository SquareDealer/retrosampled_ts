import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CreatorsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Promotes a user to "creator". Replaces the Supabase `become_creator` RPC.
   * Requires a complete profile (username + bio).
   */
  async becomeCreator(userId: string): Promise<{ isCreator: boolean }> {
    if (!userId) {
      throw new UnauthorizedException();
    }

    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new BadRequestException('Сначала создай профиль');
    }

    if (!profile.username || !profile.bio) {
      throw new BadRequestException('Заполни профиль полностью');
    }

    const updated = await this.prisma.profile.update({
      where: { userId },
      data: { isCreator: true },
    });

    return { isCreator: updated.isCreator };
  }

  async follow(
    followerId: string,
    creatorId: string,
  ): Promise<{ following: boolean }> {
    if (followerId === creatorId) {
      throw new BadRequestException('Cannot follow yourself');
    }
    const creator = await this.prisma.user.findUnique({
      where: { id: creatorId },
      select: { id: true },
    });
    if (!creator) {
      throw new BadRequestException('Creator not found');
    }
    await this.prisma.follow.upsert({
      where: { followerId_creatorId: { followerId, creatorId } },
      create: { followerId, creatorId },
      update: {},
    });
    return { following: true };
  }

  async unfollow(
    followerId: string,
    creatorId: string,
  ): Promise<{ following: boolean }> {
    await this.prisma.follow.deleteMany({ where: { followerId, creatorId } });
    return { following: false };
  }
}
