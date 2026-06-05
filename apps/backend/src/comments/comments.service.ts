import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

export type CommentUser = {
  id: string;
  username: string;
  avatarUrl?: string | null;
};

export type SampleComment = {
  id: string;
  user: CommentUser;
  text: string;
  createdAt: string;
  parentId?: string;
  replies?: SampleComment[];
  isOwner: boolean;
};

export type SampleCommentsResponse = {
  totalCount: number;
  comments: SampleComment[];
};

const commentWithUser = Prisma.validator<Prisma.CommentDefaultArgs>()({
  include: { user: { include: { profile: true } } },
});
type CommentRow = Prisma.CommentGetPayload<typeof commentWithUser>;

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    sampleId: string,
    viewerId?: string,
  ): Promise<SampleCommentsResponse> {
    const rows = await this.prisma.comment.findMany({
      where: { sampleId },
      orderBy: { createdAt: 'asc' },
      ...commentWithUser,
    });

    // Build a two-level tree: top-level comments newest-first, replies oldest-first.
    const byId = new Map<string, SampleComment>();
    const roots: SampleComment[] = [];

    for (const row of rows) {
      byId.set(row.id, this.toComment(row, viewerId));
    }
    for (const row of rows) {
      const node = byId.get(row.id)!;
      if (row.parentId && byId.has(row.parentId)) {
        const parent = byId.get(row.parentId)!;
        parent.replies = parent.replies ?? [];
        parent.replies.push(node);
      } else {
        roots.push(node);
      }
    }
    roots.reverse(); // newest top-level first

    return { totalCount: rows.length, comments: roots };
  }

  async create(
    sampleId: string,
    userId: string,
    dto: CreateCommentDto,
  ): Promise<SampleComment> {
    const sample = await this.prisma.sample.findUnique({
      where: { id: sampleId },
      select: { id: true },
    });
    if (!sample) {
      throw new NotFoundException('Sample not found');
    }

    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
        select: { id: true, sampleId: true },
      });
      if (!parent || parent.sampleId !== sampleId) {
        throw new BadRequestException('Parent comment not found');
      }
    }

    const created = await this.prisma.comment.create({
      data: {
        sampleId,
        userId,
        text: dto.text.trim(),
        parentId: dto.parentId ?? null,
      },
      ...commentWithUser,
    });

    return this.toComment(created, userId);
  }

  async remove(commentId: string, userId: string): Promise<void> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.userId !== userId) {
      throw new ForbiddenException('Not the author');
    }
    // Replies cascade via the schema's onDelete: Cascade self-relation.
    await this.prisma.comment.delete({ where: { id: commentId } });
  }

  private toComment(row: CommentRow, viewerId?: string): SampleComment {
    const profile = row.user.profile;
    return {
      id: row.id,
      user: {
        id: row.userId,
        username: profile?.username ?? 'unknown',
        avatarUrl: profile?.avatarUrl ?? null,
      },
      text: row.text,
      createdAt: row.createdAt.toISOString(),
      parentId: row.parentId ?? undefined,
      replies: row.parentId ? undefined : [],
      isOwner: !!viewerId && row.userId === viewerId,
    };
  }
}
