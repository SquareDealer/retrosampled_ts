import { Inject, Injectable, Logger } from '@nestjs/common';
import { Sample } from '@prisma/client';
import { STORAGE, StoragePort } from '../storage/storage.port';
import { SampleDeletionHook } from './sample-deletion.hook';

/**
 * `SampleDeletionHook` implementation: removes the audio, cover and peaks
 * objects of a deleted sample. Failures are logged, never rethrown — the row
 * is already gone and an orphaned object is cheaper than a failed request.
 */
@Injectable()
export class StorageCleanupHook implements SampleDeletionHook {
  private readonly logger = new Logger(StorageCleanupHook.name);

  constructor(@Inject(STORAGE) private readonly storage: StoragePort) {}

  async onSampleDeleted(
    sample: Pick<Sample, 'id' | 'audioKey' | 'coverKey' | 'peaksKey'>,
  ): Promise<void> {
    const keys = [sample.audioKey, sample.coverKey, sample.peaksKey].filter(
      (key): key is string => Boolean(key),
    );

    await Promise.all(
      keys.map(async (key) => {
        try {
          await this.storage.delete(key);
        } catch (error) {
          this.logger.warn(
            `could not delete ${key} for sample ${sample.id}: ${(error as Error).message}`,
          );
        }
      }),
    );
  }
}
