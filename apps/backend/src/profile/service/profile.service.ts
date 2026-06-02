import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Profile } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { ProfileResponseDto } from '../dto/profile-response.dto';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  private mapToResponse(profile: Profile): ProfileResponseDto {
    return {
      userId: profile.userId,
      username: profile.username ?? null,
      avatarUrl: profile.avatarUrl ?? null,
      bio: profile.bio ?? null,
      isCreator: profile.isCreator,
      links: (profile.links as Record<string, string>) ?? {},
    };
  }

  async getProfileById(userId: string): Promise<ProfileResponseDto> {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    return this.mapToResponse(profile);
  }

  async getProfileByUsername(username: string): Promise<ProfileResponseDto> {
    const profile = await this.prisma.profile.findUnique({
      where: { username },
    });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    return this.mapToResponse(profile);
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    if (dto.username) {
      const clash = await this.prisma.profile.findFirst({
        where: { username: dto.username, NOT: { userId } },
        select: { userId: true },
      });
      if (clash) {
        throw new BadRequestException('Username already taken');
      }
    }

    try {
      const updated = await this.prisma.profile.update({
        where: { userId },
        data: {
          ...(dto.username !== undefined ? { username: dto.username } : {}),
          ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
          ...(dto.avatar_url !== undefined
            ? { avatarUrl: dto.avatar_url }
            : {}),
          ...(dto.links !== undefined ? { links: dto.links } : {}),
        },
      });
      return this.mapToResponse(updated);
    } catch {
      throw new BadRequestException('Failed to update profile');
    }
  }
}
