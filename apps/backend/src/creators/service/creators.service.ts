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
}
