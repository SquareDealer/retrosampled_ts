import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import {
  AvatarResponse,
  ProfileResponse,
  PublicUserDto,
  UserListItem,
  UserRole,
  UserSearchResponse,
  UsersListResponse,
} from '@retrosampled/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import {
  decodeOptionalCursor,
  encodeCursor,
  facetHash,
} from '../../common/pagination/cursor';
import { publicUrlOrNull } from '../../storage/public-url';
import { STORAGE, StoragePort } from '../../storage/storage.port';

export type UploadedAvatar = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const AVATAR_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 50;

type UserSummaryRow = Pick<
  User,
  'id' | 'username' | 'displayName' | 'avatarKey' | 'followersCount'
>;

const USER_SUMMARY_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarKey: true,
  followersCount: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  private avatarUrl(key: string | null | undefined): string | null {
    return publicUrlOrNull(this.storage, key);
  }

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

  /** Sum of `likesCount` over the user's published samples. */
  private async likesReceived(userId: string): Promise<number> {
    const aggregate = await this.prisma.sample.aggregate({
      where: { ownerId: userId, status: 'PUBLISHED' },
      _sum: { likesCount: true },
    });

    return aggregate._sum.likesCount ?? 0;
  }

  private async isFollowing(viewerId: string | undefined, targetId: string): Promise<boolean> {
    if (!viewerId || viewerId === targetId) {
      return false;
    }

    const row = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: targetId } },
      select: { id: true },
    });

    return row !== null;
  }

  private async toPublicUser(user: User, viewerId?: string): Promise<PublicUserDto> {
    const [likesReceived, isFollowing] = await Promise.all([
      this.likesReceived(user.id),
      this.isFollowing(viewerId, user.id),
    ]);

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName ?? null,
      avatarUrl: this.avatarUrl(user.avatarKey),
      bio: user.bio ?? null,
      links: this.parseLinks(user.links),
      role: user.role as UserRole,
      createdAt: user.createdAt.toISOString(),
      stats: {
        followers: user.followersCount,
        following: user.followingCount,
        uploads: user.uploadsCount,
        remakes: user.remakesCount,
        likesReceived,
      },
      isFollowing,
      isMe: Boolean(viewerId) && viewerId === user.id,
    };
  }

  private toProfileResponse(user: User): ProfileResponse {
    return {
      userId: user.id,
      username: user.username,
      avatarUrl: this.avatarUrl(user.avatarKey),
      bio: user.bio ?? null,
      links: this.parseLinks(user.links),
    };
  }

  private toListItem(row: UserSummaryRow, followingIds: Set<string>): UserListItem {
    return {
      id: row.id,
      username: row.username,
      displayName: row.displayName ?? null,
      avatarUrl: this.avatarUrl(row.avatarKey),
      followersCount: row.followersCount,
      isFollowing: followingIds.has(row.id),
    };
  }

  /** Which of `ids` the viewer follows — one query for a whole page. */
  private async followedSubset(viewerId: string | undefined, ids: string[]): Promise<Set<string>> {
    if (!viewerId || ids.length === 0) {
      return new Set();
    }

    const rows = await this.prisma.follow.findMany({
      where: { followerId: viewerId, followingId: { in: ids } },
      select: { followingId: true },
    });

    return new Set(rows.map((row) => row.followingId));
  }

  /**
   * Profiles are addressed by username; a raw id is accepted as a fallback so
   * older links (`/user/<id>` from the sample page creators) still resolve.
   */
  private async findActiveByUsername(username: string): Promise<User> {
    const user =
      (await this.prisma.user.findUnique({ where: { username } })) ??
      (await this.prisma.user.findUnique({ where: { id: username } }));

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
      data.displayName = dto.displayName.trim() || null;
    }
    if (dto.bio !== undefined) {
      data.bio = dto.bio.trim() || null;
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

  // --- avatar --------------------------------------------------------------

  async setAvatar(userId: string, file: UploadedAvatar | undefined): Promise<AvatarResponse> {
    if (!file) {
      throw new BadRequestException('Avatar file is required (field "file")');
    }

    const extension = AVATAR_EXTENSIONS[file.mimetype];
    if (!extension) {
      throw new BadRequestException('Avatar must be a PNG, JPEG or WebP image');
    }

    if (file.size > AVATAR_MAX_BYTES) {
      throw new BadRequestException('Avatar must be 2 MB or smaller');
    }

    const user = await this.findActiveById(userId);
    const key = `avatars/${userId}.${extension}`;

    if (user.avatarKey && user.avatarKey !== key) {
      await this.storage.delete(user.avatarKey);
    }

    await this.storage.put(key, file.buffer, { contentType: file.mimetype });
    await this.prisma.user.update({ where: { id: userId }, data: { avatarKey: key } });

    return { avatarUrl: this.storage.publicUrl(key) };
  }

  async removeAvatar(userId: string): Promise<AvatarResponse> {
    const user = await this.findActiveById(userId);

    if (user.avatarKey) {
      await this.storage.delete(user.avatarKey);
      await this.prisma.user.update({ where: { id: userId }, data: { avatarKey: null } });
    }

    return { avatarUrl: null };
  }

  // --- lists ---------------------------------------------------------------

  async search(q: string, limit = 10, viewerId?: string): Promise<UserSearchResponse> {
    const query = q.trim().replace(/^@/, '');
    if (!query) {
      return { users: [] };
    }

    const rows = await this.prisma.user.findMany({
      where: {
        isActive: true,
        OR: [{ username: { contains: query } }, { displayName: { contains: query } }],
      },
      orderBy: [{ followersCount: 'desc' }, { username: 'asc' }],
      take: Math.min(Math.max(limit, 1), MAX_LIST_LIMIT),
      select: USER_SUMMARY_SELECT,
    });

    const followed = await this.followedSubset(viewerId, rows.map((row) => row.id));

    return { users: rows.map((row) => this.toListItem(row, followed)) };
  }

  private async listFollowEdges(
    username: string,
    direction: 'followers' | 'following',
    query: { cursor?: string; limit?: number },
    viewerId?: string,
  ): Promise<UsersListResponse> {
    const user = await this.findActiveByUsername(username);
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
    const hash = facetHash({ user: user.id, direction });
    const cursor = decodeOptionalCursor(query.cursor, hash);

    const where: Prisma.FollowWhereInput =
      direction === 'followers' ? { followingId: user.id } : { followerId: user.id };

    if (cursor) {
      const createdAt = new Date(Number(cursor.k));
      where.OR = [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: cursor.id } }];
    }

    const edges = await this.prisma.follow.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        follower: { select: USER_SUMMARY_SELECT },
        following: { select: USER_SUMMARY_SELECT },
      },
    });

    const page = edges.slice(0, limit);
    const last = page[page.length - 1];
    const nextCursor =
      edges.length > limit && last
        ? encodeCursor({ k: last.createdAt.getTime(), id: last.id }, hash)
        : null;

    const rows = page.map((edge) => (direction === 'followers' ? edge.follower : edge.following));
    const followed = await this.followedSubset(viewerId, rows.map((row) => row.id));

    return { users: rows.map((row) => this.toListItem(row, followed)), nextCursor };
  }

  listFollowers(username: string, query: { cursor?: string; limit?: number }, viewerId?: string) {
    return this.listFollowEdges(username, 'followers', query, viewerId);
  }

  listFollowing(username: string, query: { cursor?: string; limit?: number }, viewerId?: string) {
    return this.listFollowEdges(username, 'following', query, viewerId);
  }
}
