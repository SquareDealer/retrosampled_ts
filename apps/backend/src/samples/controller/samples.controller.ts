import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Ip,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import {
  CoverResponse,
  CreateSampleResponse,
  DownloadResponse,
  LikeResponse,
  SampleDetail,
  SamplesListResponse,
} from '@retrosampled/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalAuth } from '../../common/decorators/optional-auth.decorator';
import { RequestUser } from '../../common/types/authenticated-request';
import { coverUploadOptions, sampleUploadOptions } from '../../uploads/multer.config';
import { CreateRemakeDto } from '../dto/create-remake.dto';
import { CreateSampleDto, UpdateSampleDto } from '../dto/sample-metadata.dto';
import { SamplesQueryDto } from '../dto/samples-query.dto';
import { SetVisibilityDto } from '../dto/set-visibility.dto';
import { DownloadsService } from '../service/downloads.service';
import { LikesService } from '../service/likes.service';
import { toActor } from '../service/sample-access.service';
import { SampleUploadFiles, SamplesService } from '../service/samples.service';

/**
 * REST surface of D4 "Samples" (comments live in Task 3.2's controller).
 * Mutating endpoints that yield a sample answer `{ sample: SampleDetail }`.
 */
@Controller('samples')
export class SamplesController {
  constructor(
    private readonly samples: SamplesService,
    private readonly likes: LikesService,
    private readonly downloads: DownloadsService,
  ) {}

  @OptionalAuth()
  @Get()
  list(
    @Query() query: SamplesQueryDto,
    @CurrentUser() user: RequestUser | undefined,
  ): Promise<SamplesListResponse> {
    return this.samples.list(query, toActor(user));
  }

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'audio', maxCount: 1 },
        { name: 'cover', maxCount: 1 },
      ],
      sampleUploadOptions(),
    ),
  )
  async create(
    @CurrentUser() user: RequestUser,
    @UploadedFiles() files: SampleUploadFiles,
    @Body() dto: CreateSampleDto,
  ): Promise<CreateSampleResponse> {
    return { sample: await this.samples.create(user, files ?? {}, dto) };
  }

  @OptionalAuth()
  @Get(':id')
  getOne(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser | undefined,
  ): Promise<SampleDetail> {
    return this.samples.getDetail(id, toActor(user));
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateSampleDto,
  ): Promise<CreateSampleResponse> {
    return { sample: await this.samples.update(user, id, dto) };
  }

  @Post(':id/audio')
  @UseInterceptors(FileInterceptor('audio', sampleUploadOptions()))
  async attachAudio(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<CreateSampleResponse> {
    return { sample: await this.samples.attachAudio(user, id, file) };
  }

  @Post(':id/cover')
  @UseInterceptors(FileInterceptor('file', coverUploadOptions()))
  setCover(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<CoverResponse> {
    return this.samples.setCover(user, id, file);
  }

  @Patch(':id/visibility')
  async setVisibility(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: SetVisibilityDto,
  ): Promise<CreateSampleResponse> {
    return { sample: await this.samples.setVisibility(user, id, dto.status) };
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<void> {
    return this.samples.remove(user, id);
  }

  @Post(':id/retry-processing')
  @HttpCode(200)
  async retryProcessing(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<CreateSampleResponse> {
    return { sample: await this.samples.retryProcessing(user, id) };
  }

  @Put(':id/like')
  like(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<LikeResponse> {
    return this.likes.like(user, id);
  }

  @Delete(':id/like')
  @HttpCode(200)
  unlike(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<LikeResponse> {
    return this.likes.unlike(user, id);
  }

  @Post(':id/downloads')
  @HttpCode(200)
  download(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<DownloadResponse> {
    return this.downloads.requestDownload(user, id);
  }

  @OptionalAuth()
  @Post(':id/plays')
  @HttpCode(204)
  play(
    @CurrentUser() user: RequestUser | undefined,
    @Param('id') id: string,
    @Ip() ip: string,
  ): Promise<void> {
    return this.samples.registerPlay(toActor(user), id, ip ?? 'unknown');
  }

  @Post(':id/remakes')
  async createRemake(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CreateRemakeDto,
  ): Promise<CreateSampleResponse> {
    return { sample: await this.samples.createRemakeDraft(user, id, dto) };
  }
}
