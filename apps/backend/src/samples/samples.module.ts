import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { SamplesController } from './controller/samples.controller';
import { SampleMapper } from './mappers/sample.mapper';
import { SamplesAccessModule } from './samples-access.module';
import { AttributionService } from './service/attribution.service';
import { DownloadsService } from './service/downloads.service';
import { LikesService } from './service/likes.service';
import { SampleDetailService } from './service/sample-detail.service';
import { SamplesService } from './service/samples.service';
import { StorageCleanupHook } from './storage-cleanup.hook';

/**
 * Samples feature (Task 3.1a). `SampleMapper`, `SampleDetailService` and
 * `AttributionService` are exported for Task 3.2 (profile tabs, library,
 * comments) so every list renders through the same mapping code.
 */
@Module({
  imports: [SamplesAccessModule, UploadsModule],
  controllers: [SamplesController],
  providers: [
    SampleMapper,
    AttributionService,
    SampleDetailService,
    SamplesService,
    LikesService,
    DownloadsService,
    StorageCleanupHook,
  ],
  exports: [SampleMapper, AttributionService, SampleDetailService, SamplesService],
})
export class SamplesModule {}
