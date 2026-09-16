import { Sample } from '@prisma/client';

/** DI token for the optional {@link SampleDeletionHook}. */
export const SAMPLE_DELETION_HOOK = Symbol('SAMPLE_DELETION_HOOK');

/**
 * Extension point for "a sample row was deleted, clean up after it".
 *
 * Task 2 deletes the row and detaches the children; it has no storage layer to
 * talk to. Task 3.1a owns `src/storage/**` and should provide this hook from its
 * `SamplesModule` (`{ provide: SAMPLE_DELETION_HOOK, useClass: ... }`) to remove
 * `audioKey` / `coverKey` / `peaksKey` objects through `StoragePort`.
 *
 * Consumers inject it with `@Optional() @Inject(SAMPLE_DELETION_HOOK)` so the
 * admin module keeps working while no implementation is registered.
 */
export interface SampleDeletionHook {
  /** Called after the row is gone, with the row as it was just before deletion. */
  onSampleDeleted(sample: Sample): Promise<void>;
}
