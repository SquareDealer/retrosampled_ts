import { Inject, Injectable, Logger } from '@nestjs/common';
import { Sample } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE, StoragePort } from '../../storage/storage.port';
import { extensionOf } from '../multer.config';
import { AudioMetadataService } from './audio-metadata.service';
import { PeaksService } from './peaks.service';

export const peaksKeyFor = (sampleId: string): string => `samples/${sampleId}/peaks.json`;
export const audioKeyFor = (sampleId: string, extension: string): string =>
  `samples/${sampleId}/audio.${extension}`;
export const coverKeyFor = (sampleId: string, extension: string): string =>
  `samples/${sampleId}/cover.${extension}`;

/**
 * Turns an uploaded audio object into a playable sample:
 * `PROCESSING` → duration via music-metadata → peaks JSON → `DRAFT`,
 * or `FAILED` + `processingError`. Runs synchronously inside the request
 * (files are small) but is modelled as a status machine so a queue can take
 * over later without changing the contract. `process()` is also what
 * `POST /samples/:id/retry-processing` calls.
 */
@Injectable()
export class ProcessingService {
  private readonly logger = new Logger(ProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE) private readonly storage: StoragePort,
    private readonly metadata: AudioMetadataService,
    private readonly peaks: PeaksService,
  ) {}

  async process(sampleId: string): Promise<Sample> {
    const sample = await this.prisma.sample.findUnique({ where: { id: sampleId } });

    if (!sample) {
      throw new Error(`Sample ${sampleId} not found`);
    }

    if (!sample.audioKey) {
      return this.prisma.sample.update({
        where: { id: sampleId },
        data: { status: 'FAILED', processingError: 'No audio file attached' },
      });
    }

    await this.prisma.sample.update({
      where: { id: sampleId },
      data: { status: 'PROCESSING', processingError: null },
    });

    try {
      const buffer = await this.storage.get(sample.audioKey);
      const extension = extensionOf(sample.audioKey) === 'aif' ? 'aiff' : extensionOf(sample.audioKey);
      const mime = sample.audioMime ?? 'application/octet-stream';

      const metadata = await this.metadata.parse(buffer, mime);

      if (metadata.durationSec === null || !Number.isFinite(metadata.durationSec)) {
        throw new Error('Could not decode the audio file');
      }

      const peaks = await this.peaks.generate({
        buffer,
        extension,
        durationSec: metadata.durationSec,
        sampleRate: metadata.sampleRate,
      });

      let peaksKey: string | null = null;

      if (peaks) {
        peaksKey = peaksKeyFor(sampleId);
        await this.storage.put(peaksKey, Buffer.from(JSON.stringify(peaks)), {
          contentType: 'application/json',
        });
      }

      return await this.prisma.sample.update({
        where: { id: sampleId },
        data: {
          status: 'DRAFT',
          durationSec: metadata.durationSec,
          peaksKey,
          processingError: null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Processing failed';
      this.logger.warn(`processing failed for sample ${sampleId}: ${message}`);

      return this.prisma.sample.update({
        where: { id: sampleId },
        data: { status: 'FAILED', processingError: message },
      });
    }
  }
}
