import { Global, Module } from '@nestjs/common';
import { SAMPLE_DELETION_HOOK } from './sample-deletion.hook';
import { StorageCleanupHook } from './storage-cleanup.hook';

/**
 * Registers the storage-cleanup implementation of `SAMPLE_DELETION_HOOK`.
 * Global so `AdminModule` (which only imports `SamplesAccessModule`) resolves
 * its optional injection without importing the whole samples feature.
 */
@Global()
@Module({
  providers: [{ provide: SAMPLE_DELETION_HOOK, useClass: StorageCleanupHook }],
  exports: [SAMPLE_DELETION_HOOK],
})
export class SampleDeletionHookModule {}
