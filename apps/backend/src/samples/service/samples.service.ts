import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import {
  Actor,
  CoverResponse,
  SampleDetail,
  SampleVisibility,
  SamplesListResponse,
} from '@retrosampled/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/types/authenticated-request';
import { STORAGE, StoragePort } from '../../storage/storage.port';
import {
  UploadedFileLike,
  ValidatedFile,
  validateAudioFile,
  validateCoverFile,
} from '../../uploads/audio-file.validator';
import { DEFAULT_MAX_UPLOAD_MB } from '../../uploads/multer.config';
import {
  ProcessingService,
  audioKeyFor,
  coverKeyFor,
} from '../../uploads/service/processing.service';
import { CreateRemakeDto } from '../dto/create-remake.dto';
import { CreateSampleDto, SampleMetadataDto, UpdateSampleDto } from '../dto/sample-metadata.dto';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, SamplesQueryDto } from '../dto/samples-query.dto';
import { SampleMapper, feedIncludeFor } from '../mappers/sample.mapper';
import { PlayThrottle } from './play-throttle';
import { AccessibleSample, SampleAccessService, toActor } from './sample-access.service';
import { SampleDetailService } from './sample-detail.service';
import { StorageCleanupHook } from '../storage-cleanup.hook';

export type SampleUploadFiles = {
  audio?: UploadedFileLike[];
  cover?: UploadedFileLike[];
};

/** Lower-cased, de-duplicated tag names (max length is enforced by the DTO). */
export function normalizeTags(tags: string[] | undefined): string[] | undefined {
  if (tags === undefined) {
    return undefined;
  }

  const seen = new Set<string>();
  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase().replace(/\s+/g, '-');
    if (normalized) {
      seen.add(normalized);
    }
  }

  return Array.from(seen);
}

/** `drum_break-94.wav` → `drum break 94`. */
export function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return base || 'untitled sample';
}

/**
 * Feed, CRUD, visibility, processing retry and plays for samples. Access is
 * always resolved through `SampleAccessService` so hidden samples 404 and
 * forbidden actions 403 exactly like everywhere else.
 */
@Injectable()
export class SamplesService {
  private readonly logger = new Logger(SamplesService.name);
  private readonly maxUploadBytes: number;
  private readonly playThrottle = new PlayThrottle();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SampleAccessService,
    private readonly mapper: SampleMapper,
    private readonly detail: SampleDetailService,
    private readonly processing: ProcessingService,
    private readonly cleanup: StorageCleanupHook,
    @Inject(STORAGE) private readonly storage: StoragePort,
    config: ConfigService,
  ) {
    const mb = Number(config.get('MAX_UPLOAD_MB') ?? DEFAULT_MAX_UPLOAD_MB);
    this.maxUploadBytes = (Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_MAX_UPLOAD_MB) * 1024 * 1024;
  }

  // ---------------------------------------------------------------- listing

  async list(query: SamplesQueryDto, actor: Actor): Promise<SamplesListResponse> {
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, query.limit ?? DEFAULT_PAGE_SIZE));
    const viewerId = actor?.id;
    const filters: Prisma.SampleWhereInput[] = [];

    // --- who is asked for / visibility -----------------------------------
    let author: { id: string } | null = null;

    if (query.author) {
      author = await this.prisma.user.findUnique({
        where: { username: query.author.toLowerCase() },
        select: { id: true },
      });

      if (!author) {
        return { samples: [] };
      }
    }

    const viewerOwnsScope =
      actor !== null && author !== null && (actor.id === author.id || actor.role === 'ADMIN');

    if (query.sort === 'liked' && !actor) {
      throw new UnauthorizedException('Sign in to see liked samples');
    }

    if (author) {
      const tab = query.tab ?? 'uploads';

      if (tab === 'liked') {
        filters.push({ likes: { some: { userId: author.id } } });
        // Someone else's liked list only ever exposes published samples.
        filters.push(
          viewerOwnsScope ? { OR: [{ status: 'PUBLISHED' }, { ownerId: actor!.id }] } : { status: 'PUBLISHED' },
        );
      } else {
        filters.push({ ownerId: author.id });
        filters.push(tab === 'remakes' ? { parentId: { not: null } } : { parentId: null });
        if (!viewerOwnsScope) {
          filters.push({ status: 'PUBLISHED' });
        }
      }
    } else {
      filters.push({ status: 'PUBLISHED' });
    }

    if (query.sort === 'liked' && actor) {
      filters.push({ likes: { some: { userId: actor.id } } });
    }

    // --- filters ---------------------------------------------------------
    const search = query.search?.trim();
    if (search) {
      filters.push({
        OR: [
          { title: { contains: search } },
          { owner: { username: { contains: search } } },
          { tags: { some: { tag: { name: { contains: search.toLowerCase() } } } } },
        ],
      });
    }

    const tags = normalizeTags(query.tags) ?? [];
    for (const tag of tags) {
      filters.push({ tags: { some: { tag: { name: tag } } } });
    }

    if (query.bpm_min !== undefined) {
      filters.push({ bpm: { gte: query.bpm_min } });
    }
    if (query.bpm_max !== undefined) {
      filters.push({ bpm: { lte: query.bpm_max } });
    }
    if (query.key) {
      filters.push({ musicalKey: query.key });
    }

    const where: Prisma.SampleWhereInput = { AND: filters };

    // --- ordering + keyset cursor -----------------------------------------
    if (query.sort === 'liked' && actor) {
      // Order by *when the viewer liked it*; the cursor is the Like id.
      const likes = await this.prisma.like.findMany({
        where: { userId: actor.id, sample: where },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        include: { sample: { include: feedIncludeFor(viewerId) } },
      });

      const hasMore = likes.length > limit;
      const page = hasMore ? likes.slice(0, limit) : likes;

      return {
        samples: page.map((like) => this.mapper.toSample(like.sample)),
        nextCursor: hasMore ? page[page.length - 1]?.id : undefined,
      };
    }

    const orderBy: Prisma.SampleOrderByWithRelationInput[] =
      query.sort === 'popular'
        ? [{ likesCount: 'desc' }, { id: 'desc' }]
        : query.sort === 'remakes'
          ? [{ remakesCount: 'desc' }, { id: 'desc' }]
          : [{ createdAt: 'desc' }, { id: 'desc' }];

    const rows = await this.prisma.sample.findMany({
      where,
      orderBy,
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: feedIncludeFor(viewerId),
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      samples: page.map((row) => this.mapper.toSample(row)),
      nextCursor: hasMore ? page[page.length - 1]?.id : undefined,
    };
  }

  getDetail(sampleId: string, actor: Actor): Promise<SampleDetail> {
    return this.detail.getDetail(sampleId, actor);
  }

  // ---------------------------------------------------------------- create

  async create(
    actor: RequestUser,
    files: SampleUploadFiles,
    dto: CreateSampleDto,
  ): Promise<SampleDetail> {
    const audio = validateAudioFile(files.audio?.[0], this.maxUploadBytes);
    const cover = files.cover?.[0] ? validateCoverFile(files.cover[0]) : null;

    const parent = dto.parentId
      ? await this.access.assertCan(toActor(actor), 'sample:remake', dto.parentId)
      : null;

    const id = randomUUID();
    const title = (dto.title?.trim() || titleFromFilename(audio.originalName)).slice(0, 80);
    const collaboratorIds = await this.resolveCollaborators(dto.collaboratorIds, actor.id);
    const tags = normalizeTags(dto.tags) ?? (parent ? await this.tagsOf(parent.id) : []);

    await this.prisma.sample.create({
      data: {
        id,
        ownerId: actor.id,
        parentId: parent?.id ?? null,
        rootId: parent ? parent.rootId : id,
        depth: parent ? parent.depth + 1 : 0,
        title,
        description: dto.description ?? null,
        status: 'PROCESSING',
        bpm: dto.bpm ?? parent?.bpm ?? null,
        musicalKey: dto.musicalKey ?? parent?.musicalKey ?? null,
        sampleType: dto.sampleType ?? parent?.sampleType ?? null,
        collaborators: { create: collaboratorIds.map((userId) => ({ userId })) },
      },
    });

    await this.replaceTags(id, tags);

    try {
      await this.storeAudio(id, audio);
      if (cover) {
        await this.storeCover(id, cover);
      }
    } catch (error) {
      await this.prisma.sample.update({
        where: { id },
        data: { status: 'FAILED', processingError: (error as Error).message },
      });
      this.logger.error(`storing upload for sample ${id} failed: ${(error as Error).message}`);
      return this.detail.getDetail(id, toActor(actor));
    }

    await this.processing.process(id);

    return this.detail.getDetail(id, toActor(actor));
  }

  /** `POST /samples/:id/remakes`: an empty DRAFT child the wizard fills later. */
  async createRemakeDraft(
    actor: RequestUser,
    parentId: string,
    dto: CreateRemakeDto,
  ): Promise<SampleDetail> {
    const parent = await this.access.assertCan(toActor(actor), 'sample:remake', parentId);
    const id = randomUUID();

    await this.prisma.sample.create({
      data: {
        id,
        ownerId: actor.id,
        parentId: parent.id,
        rootId: parent.rootId,
        depth: parent.depth + 1,
        title: (dto.title?.trim() || `${parent.title} (remake)`).slice(0, 80),
        status: 'DRAFT',
        bpm: parent.bpm,
        musicalKey: parent.musicalKey,
        sampleType: parent.sampleType,
      },
    });

    await this.replaceTags(id, await this.tagsOf(parent.id));

    return this.detail.getDetail(id, toActor(actor));
  }

  /** `POST /samples/:id/audio`: attach or replace the audio of a draft and reprocess. */
  async attachAudio(
    actor: RequestUser,
    sampleId: string,
    file: UploadedFileLike | undefined,
  ): Promise<SampleDetail> {
    const sample = await this.access.assertCan(toActor(actor), 'sample:edit', sampleId);
    const audio = validateAudioFile(file, this.maxUploadBytes);

    if (sample.audioKey && sample.audioKey !== audioKeyFor(sampleId, audio.extension)) {
      await this.storage.delete(sample.audioKey).catch(() => undefined);
    }

    await this.storeAudio(sampleId, audio);
    await this.processing.process(sampleId);

    return this.detail.getDetail(sampleId, toActor(actor));
  }

  // ---------------------------------------------------------------- update

  async update(actor: RequestUser, sampleId: string, dto: UpdateSampleDto): Promise<SampleDetail> {
    await this.access.assertCan(toActor(actor), 'sample:edit', sampleId);

    const data: Prisma.SampleUncheckedUpdateInput = {};

    if (dto.title !== undefined) {
      const title = dto.title.trim();
      if (!title) {
        throw new BadRequestException('Title cannot be empty');
      }
      data.title = title;
    }
    if (dto.description !== undefined) data.description = dto.description || null;
    if (dto.bpm !== undefined) data.bpm = dto.bpm;
    if (dto.musicalKey !== undefined) data.musicalKey = dto.musicalKey || null;
    if (dto.sampleType !== undefined) data.sampleType = dto.sampleType;

    if (Object.keys(data).length > 0) {
      await this.prisma.sample.update({ where: { id: sampleId }, data });
    }

    const tags = normalizeTags(dto.tags);
    if (tags !== undefined) {
      await this.replaceTags(sampleId, tags);
    }

    if (dto.collaboratorIds !== undefined) {
      const collaboratorIds = await this.resolveCollaborators(dto.collaboratorIds, actor.id);
      await this.prisma.$transaction([
        this.prisma.sampleCollaborator.deleteMany({ where: { sampleId } }),
        this.prisma.sampleCollaborator.createMany({
          data: collaboratorIds.map((userId) => ({ sampleId, userId })),
        }),
      ]);
    }

    return this.detail.getDetail(sampleId, toActor(actor));
  }

  async setCover(
    actor: RequestUser,
    sampleId: string,
    file: UploadedFileLike | undefined,
  ): Promise<CoverResponse> {
    const sample = await this.access.assertCan(toActor(actor), 'sample:edit', sampleId);
    const cover = validateCoverFile(file);
    const key = coverKeyFor(sampleId, cover.extension);

    if (sample.coverKey && sample.coverKey !== key) {
      await this.storage.delete(sample.coverKey).catch(() => undefined);
    }

    await this.storeCover(sampleId, cover);

    return { coverUrl: this.storage.publicUrl(key) };
  }

  async setVisibility(
    actor: RequestUser,
    sampleId: string,
    visibility: SampleVisibility,
  ): Promise<SampleDetail> {
    const sample = await this.access.assertCan(toActor(actor), 'sample:publish', sampleId);

    if (sample.status === 'PROCESSING' || sample.status === 'FAILED') {
      throw new UnprocessableEntityException(
        sample.status === 'PROCESSING'
          ? 'The sample is still processing'
          : 'Processing failed; retry it before changing visibility',
      );
    }

    const problems = this.publishProblems(sample);
    if (visibility === 'published' && problems.length > 0) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: problems,
        error: 'Unprocessable Entity',
      });
    }

    const wasPublished = sample.status === 'PUBLISHED';
    const status = visibility === 'published' ? 'PUBLISHED' : 'PRIVATE';

    await this.prisma.sample.update({
      where: { id: sampleId },
      data: {
        status,
        publishedAt: status === 'PUBLISHED' ? (sample.publishedAt ?? new Date()) : sample.publishedAt,
      },
    });

    await this.recomputeCounters(sample.ownerId, sample.parentId);

    if (status === 'PUBLISHED' && !wasPublished && sample.parentId && !sample.publishedAt) {
      await this.notifyRemake(actor, sample);
    }

    return this.detail.getDetail(sampleId, toActor(actor));
  }

  /** Reasons a sample cannot be published; empty when it is ready. */
  publishProblems(
    sample: Pick<AccessibleSample, 'audioKey' | 'durationSec' | 'title' | 'bpm' | 'musicalKey'>,
  ): string[] {
    const problems: string[] = [];

    if (!sample.audioKey || sample.durationSec === null) {
      problems.push('Audio is not processed yet');
    }
    if (!sample.title || !sample.title.trim()) {
      problems.push('Title is required');
    }
    if (sample.bpm === null || sample.bpm === undefined) {
      problems.push('BPM is required');
    }
    if (!sample.musicalKey) {
      problems.push('Key is required');
    }

    return problems;
  }

  async retryProcessing(actor: RequestUser, sampleId: string): Promise<SampleDetail> {
    const sample = await this.access.assertCan(toActor(actor), 'sample:edit', sampleId);

    if (sample.status !== 'FAILED') {
      throw new ConflictException('Only failed uploads can be retried');
    }

    await this.processing.process(sampleId);

    return this.detail.getDetail(sampleId, toActor(actor));
  }

  // ---------------------------------------------------------------- delete

  async remove(actor: RequestUser, sampleId: string): Promise<void> {
    const sample = await this.access.assertCan(toActor(actor), 'sample:delete', sampleId);
    const children = await this.prisma.sample.findMany({
      where: { parentId: sampleId },
      select: { id: true },
    });

    await this.prisma.$transaction([
      this.prisma.tag.updateMany({
        where: { samples: { some: { sampleId } }, usageCount: { gt: 0 } },
        data: { usageCount: { decrement: 1 } },
      }),
      // Direct remakes become roots of their own trees.
      ...children.map((child) =>
        this.prisma.sample.update({
          where: { id: child.id },
          data: { parentId: null, rootId: child.id, depth: 0 },
        }),
      ),
      this.prisma.sample.delete({ where: { id: sampleId } }),
    ]);

    await this.cleanup.onSampleDeleted(sample);
    await this.recomputeCounters(sample.ownerId, sample.parentId);
  }

  // ---------------------------------------------------------------- plays

  async registerPlay(actor: Actor, sampleId: string, ip: string): Promise<void> {
    const visible = await this.access.check(actor, 'sample:play', sampleId);

    if (!visible) {
      throw new NotFoundException('Sample not found');
    }

    if (!this.playThrottle.allow(ip, sampleId)) {
      return;
    }

    await this.prisma.sample.update({
      where: { id: sampleId },
      data: { playsCount: { increment: 1 } },
    });
  }

  // ---------------------------------------------------------------- helpers

  private async storeAudio(sampleId: string, audio: ValidatedFile): Promise<void> {
    const key = audioKeyFor(sampleId, audio.extension);
    await this.storage.put(key, audio.buffer, { contentType: audio.mime });
    await this.prisma.sample.update({
      where: { id: sampleId },
      data: { audioKey: key, audioMime: audio.mime, audioSizeBytes: audio.size },
    });
  }

  private async storeCover(sampleId: string, cover: ValidatedFile): Promise<void> {
    const key = coverKeyFor(sampleId, cover.extension);
    await this.storage.put(key, cover.buffer, { contentType: cover.mime });
    await this.prisma.sample.update({ where: { id: sampleId }, data: { coverKey: key } });
  }

  private async tagsOf(sampleId: string): Promise<string[]> {
    const rows = await this.prisma.sampleTag.findMany({
      where: { sampleId },
      include: { tag: { select: { name: true } } },
    });
    return rows.map((row) => row.tag.name);
  }

  /** Replaces the sample's tag set, keeping `Tag.usageCount` in step. */
  private async replaceTags(sampleId: string, names: string[]): Promise<void> {
    const current = await this.tagsOf(sampleId);
    const next = new Set(names);
    const removed = current.filter((name) => !next.has(name));
    const added = names.filter((name) => !current.includes(name));

    if (removed.length === 0 && added.length === 0) {
      return;
    }

    const tagIds = new Map<string, string>();
    for (const name of added) {
      const tag = await this.prisma.tag.upsert({
        where: { name },
        create: { name, usageCount: 1 },
        update: { usageCount: { increment: 1 } },
        select: { id: true },
      });
      tagIds.set(name, tag.id);
    }

    await this.prisma.$transaction([
      ...(removed.length
        ? [
            this.prisma.sampleTag.deleteMany({
              where: { sampleId, tag: { name: { in: removed } } },
            }),
            this.prisma.tag.updateMany({
              where: { name: { in: removed }, usageCount: { gt: 0 } },
              data: { usageCount: { decrement: 1 } },
            }),
          ]
        : []),
      ...(added.length
        ? [
            this.prisma.sampleTag.createMany({
              data: added.map((name) => ({ sampleId, tagId: tagIds.get(name)! })),
            }),
          ]
        : []),
    ]);
  }

  /** Drops unknown users and the owner; keeps the caller's order. */
  private async resolveCollaborators(
    ids: string[] | undefined,
    ownerId: string,
  ): Promise<string[]> {
    const wanted = Array.from(new Set((ids ?? []).filter((id) => id && id !== ownerId)));
    if (wanted.length === 0) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: wanted }, isActive: true },
      select: { id: true },
    });
    const known = new Set(users.map((user) => user.id));
    const unknown = wanted.filter((id) => !known.has(id));

    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown collaborator id(s): ${unknown.join(', ')}`);
    }

    return wanted;
  }

  /**
   * Published-only counters: the owner's `uploadsCount` / `remakesCount` and
   * the parent's `remakesCount`. Cheap enough to recompute on every transition.
   */
  async recomputeCounters(ownerId: string, parentId: string | null): Promise<void> {
    const [uploads, remakes] = await Promise.all([
      this.prisma.sample.count({ where: { ownerId, parentId: null, status: 'PUBLISHED' } }),
      this.prisma.sample.count({ where: { ownerId, parentId: { not: null }, status: 'PUBLISHED' } }),
    ]);

    await this.prisma.user.updateMany({
      where: { id: ownerId },
      data: { uploadsCount: uploads, remakesCount: remakes },
    });

    if (parentId) {
      const count = await this.prisma.sample.count({ where: { parentId, status: 'PUBLISHED' } });
      await this.prisma.sample.updateMany({ where: { id: parentId }, data: { remakesCount: count } });
    }
  }

  private async notifyRemake(actor: RequestUser, sample: AccessibleSample): Promise<void> {
    if (!sample.parentId) {
      return;
    }

    const parent = await this.prisma.sample.findUnique({
      where: { id: sample.parentId },
      select: { ownerId: true, title: true },
    });

    if (!parent || parent.ownerId === actor.id) {
      return;
    }

    await this.prisma.notification.create({
      data: {
        userId: parent.ownerId,
        actorId: actor.id,
        type: 'REMAKE',
        sampleId: sample.id,
        data: JSON.stringify({ parentTitle: parent.title, sampleTitle: sample.title }),
      },
    });
  }
}

export type { SampleMetadataDto };
