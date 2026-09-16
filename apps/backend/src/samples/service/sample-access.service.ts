import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Comment, Sample } from '@prisma/client';
import {
  Action,
  Actor,
  CommentResource,
  SampleResource,
  SampleStatus,
  can,
} from '@retrosampled/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/types/authenticated-request';

/** A sample row plus the flattened collaborator ids `can()` needs. */
export type AccessibleSample = Sample & { collaboratorIds: string[] };

/** A comment row plus the sample it hangs on (already access-checked). */
export type AccessibleComment = Comment & { sample: AccessibleSample };

/**
 * Turns `req.user` into the `Actor` shape `can()` expects. `undefined` (an
 * `@OptionalAuth()` route without a token) becomes `null`, i.e. a guest.
 */
export function toActor(user?: RequestUser | null): Actor {
  return user ? { id: user.id, role: user.role } : null;
}

/**
 * The one place that decides whether a request may touch a sample or a comment.
 *
 * It loads the row **once** and answers with the row itself, so callers do not
 * re-query: `const sample = await access.assertCan(actor, 'sample:edit', id)`.
 *
 * Failure modes follow D5:
 * - the row does not exist, or the actor may not even see it → `404`
 *   (a private/draft sample must not be enumerable);
 * - the actor may see it but not perform the action → `403` for a signed-in
 *   actor, `401` for a guest (guests get "log in", not "you are not allowed").
 */
@Injectable()
export class SampleAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Builds the `can()` resource for a loaded sample row. */
  static toSampleResource(sample: AccessibleSample): SampleResource {
    return {
      kind: 'sample',
      ownerId: sample.ownerId,
      status: sample.status as SampleStatus,
      collaboratorIds: sample.collaboratorIds,
    };
  }

  /** Builds the `can()` resource for a loaded comment row. */
  static toCommentResource(comment: AccessibleComment): CommentResource {
    return {
      kind: 'comment',
      authorId: comment.userId,
      sampleOwnerId: comment.sample.ownerId,
    };
  }

  private deny(actor: Actor, message: string): never {
    if (actor === null) {
      throw new UnauthorizedException('Authentication required');
    }

    throw new ForbiddenException(message);
  }

  /**
   * Loads a sample with its collaborator ids. Throws 404 when the row is gone;
   * visibility is *not* checked here (use `assertCan`).
   */
  async loadSample(sampleId: string): Promise<AccessibleSample> {
    const sample = await this.prisma.sample.findUnique({
      where: { id: sampleId },
      include: { collaborators: { select: { userId: true } } },
    });

    if (!sample) {
      throw new NotFoundException('Sample not found');
    }

    const { collaborators, ...row } = sample;

    return {
      ...row,
      collaboratorIds: collaborators.map((collaborator) => collaborator.userId),
    };
  }

  /**
   * Asserts that `actor` may perform `action` on the sample and returns the row.
   * The sample is read once; callers should reuse the returned row.
   */
  async assertCan(
    actor: Actor,
    action: Action,
    sampleId: string,
  ): Promise<AccessibleSample> {
    const sample = await this.loadSample(sampleId);
    const resource = SampleAccessService.toSampleResource(sample);

    // Invisible beats forbidden: never leak the existence of a hidden sample.
    if (!can(actor, 'sample:view', resource)) {
      throw new NotFoundException('Sample not found');
    }

    if (!can(actor, action, resource)) {
      this.deny(actor, `Not allowed to ${action} this sample`);
    }

    return sample;
  }

  /** `assertCan` without throwing — useful for building DTO flags (`canEdit`). */
  async check(actor: Actor, action: Action, sampleId: string): Promise<boolean> {
    const sample = await this.loadSample(sampleId).catch(() => null);

    if (!sample) {
      return false;
    }

    const resource = SampleAccessService.toSampleResource(sample);

    return can(actor, 'sample:view', resource) && can(actor, action, resource);
  }

  /**
   * Asserts that `actor` may perform a `comment:*` action on the comment and
   * returns it together with its sample. Soft-deleted comments and comments on
   * a sample the actor cannot see are 404.
   */
  async assertCanComment(
    actor: Actor,
    action: Action,
    commentId: string,
  ): Promise<AccessibleComment> {
    const row = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        sample: { include: { collaborators: { select: { userId: true } } } },
      },
    });

    if (!row || row.deletedAt) {
      throw new NotFoundException('Comment not found');
    }

    const { collaborators, ...sampleRow } = row.sample;
    const comment: AccessibleComment = {
      ...row,
      sample: {
        ...sampleRow,
        collaboratorIds: collaborators.map((collaborator) => collaborator.userId),
      },
    };

    if (!can(actor, 'sample:view', SampleAccessService.toSampleResource(comment.sample))) {
      throw new NotFoundException('Comment not found');
    }

    if (!can(actor, action, SampleAccessService.toCommentResource(comment))) {
      this.deny(actor, `Not allowed to ${action} this comment`);
    }

    return comment;
  }
}
