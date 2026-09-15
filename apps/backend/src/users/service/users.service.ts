import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { ProfileResponse, PublicUserDto, UserRole } from '@retrosampled/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from '../dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private parseLinks(raw: string | null | undefined): Record<string, string> {
    if (!raw) {
      return {};
    }

    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, string>)
        : {};
    } catch {
      return {};
    }
  }

  private toPublicUser(user: User, viewerId?: string): PublicUserDto {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName ?? null,
      avatarUrl: user.avatarKey ?? null,
      bio: user.bio ?? null,
      links: this.parseLinks(user.links),
      role: user.role as UserRole,
      createdAt: user.createdAt.toISOString(),
      stats: {
        followers: user.followersCount,
        following: user.followingCount,
        uploads: user.uploadsCount,
        remakes: user.remakesCount,
        // TODO(Task 3.2): aggregate likes received across the user's samples.
        likesReceived: 0,
      },
      // TODO(Task 3.2): resolve from the Follow table once follows land.
      isFollowing: false,
      isMe: Boolean(viewerId) && viewerId === user.id,
    };
  }

  private toProfileResponse(user: User): ProfileResponse {
    return {
      userId: user.id,
      username: user.username,
      avatarUrl: user.avatarKey ?? null,
      bio: user.bio ?? null,
      links: this.parseLinks(user.links),
    };
  }

  private async findActiveByUsername(username: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { username } });

    if (!user || !user.isActive) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async findActiveById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user || !user.isActive) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getPublicUser(username: string, viewerId?: string): Promise<PublicUserDto> {
    return this.toPublicUser(await this.findActiveByUsername(username), viewerId);
  }

  async getProfile(username: string): Promise<ProfileResponse> {
    return this.toProfileResponse(await this.findActiveByUsername(username));
  }

  private buildUpdateData(dto: UpdateUserDto): Prisma.UserUpdateInput {
    const data: Prisma.UserUpdateInput = {};

    if (dto.username !== undefined) {
      data.username = dto.username.toLowerCase();
    }
    if (dto.displayName !== undefined) {
      data.displayName = dto.displayName;
    }
    if (dto.bio !== undefined) {
      data.bio = dto.bio;
    }
    if (dto.links !== undefined) {
      data.links = JSON.stringify(dto.links);
    }

    return data;
  }

  private async update(userId: string, dto: UpdateUserDto): Promise<User> {
    await this.findActiveById(userId);

    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: this.buildUpdateData(dto),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Username already taken');
      }
      throw error;
    }
  }

  async updateMe(userId: string, dto: UpdateUserDto): Promise<PublicUserDto> {
    return this.toPublicUser(await this.update(userId, dto), userId);
  }

  async updateMyProfile(userId: string, dto: UpdateUserDto): Promise<ProfileResponse> {
    return this.toProfileResponse(await this.update(userId, dto));
  }
}
