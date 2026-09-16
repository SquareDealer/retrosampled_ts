import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import {
  AdminSampleDto,
  AdminUserDto,
  AdminUsersResponse,
  AdminVisibility,
  SampleStatus,
  UserRole,
} from '@retrosampled/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/types/authenticated-request';
import {
  SAMPLE_DELETION_HOOK,
  SampleDeletionHook,
} from '../../samples/sample-deletion.hook';
import {
  AccessibleSample,
  SampleAccessService,
  toActor,
} from '../../samples/service/sample-access.service';
import { ListUsersQueryDto } from '../dto/list-users-query.dto';
import { UpdateAdminUserDto } from '../dto/update-admin-user.dto';

const DEFAULT_PAGE_SIZE = 25;

const STATUS_BY_VISIBILITY: Record<AdminVisibility, SampleStatus> = {
  published: 'PUBLISHED',
  private: 'PRIVATE',
};

/**
 * Moderation operations. Every route behind it is `@Roles('ADMIN')`, so the
 * service does not re-check the account role; it only enforces the rules that
 * the role alone does not cover (you cannot lock yourself out) and reuses
 * `SampleAccessService` so a missing sample/comment 404s exactly like it does
 * for ordinary users.
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sampleAccess: SampleAccessService,
    @Optional()
    @Inject(SAMPLE_DELETION_HOOK)
    private readonly deletionHook?: SampleDeletionHook,
  ) {}

  private toAdminUser(user: User): AdminUserDto {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role as UserRole,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
    };
  }

  /**
   * Newest-first, keyset-paginated over `(createdAt, id)`. The cursor is just
   * the id of the last row of the previous page.
   */
  async listUsers(query: ListUsersQueryDto): Promise<AdminUsersResponse> {
    const take = query.limit ?? DEFAULT_PAGE_SIZE;
    const search = query.q?.trim();

    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { email: { contains: search } },
            { username: { contains: search } },
            { displayName: { contains: search } },
          ],
        }
      : {};

    const rows = await this.prisma.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;

    return {
      users: page.map((user) => this.toAdminUser(user)),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  async updateUser(
    actor: RequestUser,
    userId: string,
    dto: UpdateAdminUserDto,
  ): Promise<AdminUserDto> {
    if (dto.role === undefined && dto.isActive === undefined) {
      throw new BadRequestException('Nothing to update');
    }

    // Guard against an admin locking themselves out of the admin area.
    if (userId === actor.id) {
      if (dto.role !== undefined && dto.role !== 'ADMIN') {
        throw new BadRequestException('You cannot change your own role');
      }
      if (dto.isActive === false) {
        throw new BadRequestException('You cannot deactivate your own account');
      }
    }

    const existing = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.role !== undefined) {
      data.role = dto.role;
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    const updated = await this.prisma.user.update({ where: { id: userId }, data });

    // Deactivating an account must not leave usable sessions behind.
    if (dto.isActive === false) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    this.logger.log(
      `admin ${actor.username} updated user ${updated.username}: ${JSON.stringify(dto)}`,
    );

    return this.toAdminUser(updated);
  }

  private toAdminSample(sample: {
    id: string;
    ownerId: string;
    title: string;
    status: string;
    publishedAt: Date | null;
  }): AdminSampleDto {
    return {
      id: sample.id,
      ownerId: sample.ownerId,
      title: sample.title,
      status: sample.status as SampleStatus,
      publishedAt: sample.publishedAt ? sample.publishedAt.toISOString() : null,
    };
  }

  /**
   * Deletes the row and detaches its remakes (`parentId = null`), so the tree
   * below it survives as a set of new roots.
   *
   * Storage objects (`audioKey` / `coverKey` / `peaksKey`) are *not* removed
   * here: Task 2 has no storage layer. Task 3.1a wires a `SampleDeletionHook`
   * implementation (see `src/samples/sample-deletion.hook.ts`) and this method
   * starts cleaning up without further changes.
   */
  async deleteSample(actor: RequestUser, sampleId: string): Promise<void> {
    const sample: AccessibleSample = await this.sampleAccess.assertCan(
      toActor(actor),
      'sample:delete',
      sampleId,
    );

    await this.prisma.$transaction([
      this.prisma.sample.updateMany({
        where: { parentId: sample.id },
        data: { parentId: null },
      }),
      this.prisma.sample.delete({ where: { id: sample.id } }),
    ]);

    this.logger.log(`admin ${actor.username} deleted sample ${sample.id}`);

    // TODO(Task 3.1a): remove the audio / cover / peaks objects from StoragePort.
    if (this.deletionHook) {
      await this.deletionHook.onSampleDeleted(sample);
    }
  }

  async setSampleVisibility(
    actor: RequestUser,
    sampleId: string,
    visibility: AdminVisibility,
  ): Promise<AdminSampleDto> {
    const sample = await this.sampleAccess.assertCan(
      toActor(actor),
      'sample:publish',
      sampleId,
    );

    const status = STATUS_BY_VISIBILITY[visibility];

    const updated = await this.prisma.sample.update({
      where: { id: sample.id },
      data: {
        status,
        publishedAt:
          status === 'PUBLISHED' ? (sample.publishedAt ?? new Date()) : sample.publishedAt,
      },
    });

    this.logger.log(
      `admin ${actor.username} set sample ${sample.id} visibility to ${visibility}`,
    );

    return this.toAdminSample(updated);
  }

  /** Soft delete: the row stays so reply threads keep their shape. */
  async deleteComment(actor: RequestUser, commentId: string): Promise<void> {
    const comment = await this.sampleAccess.assertCanComment(
      toActor(actor),
      'comment:delete',
      commentId,
    );

    await this.prisma.$transaction([
      this.prisma.comment.update({
        where: { id: comment.id },
        data: { deletedAt: new Date(), text: '' },
      }),
      this.prisma.sample.updateMany({
        where: { id: comment.sampleId, commentsCount: { gt: 0 } },
        data: { commentsCount: { decrement: 1 } },
      }),
    ]);

    this.logger.log(`admin ${actor.username} deleted comment ${comment.id}`);
  }
}
