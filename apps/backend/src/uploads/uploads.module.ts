import { Module } from '@nestjs/common';
import { AudioMetadataService } from './service/audio-metadata.service';
import { PeaksService } from './service/peaks.service';
import { ProcessingService } from './service/processing.service';

/** Audio processing pipeline; `PrismaModule` and `StorageModule` are global. */
@Module({
  providers: [AudioMetadataService, PeaksService, ProcessingService],
  exports: [AudioMetadataService, PeaksService, ProcessingService],
})
export class UploadsModule {}
