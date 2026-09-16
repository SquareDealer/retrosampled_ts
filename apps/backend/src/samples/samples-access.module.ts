import { Module } from '@nestjs/common';
import { SampleAccessService } from './service/sample-access.service';

/**
 * Deliberately tiny module holding only `SampleAccessService`, so the admin
 * module (and, later, Task 3.1a's `SamplesModule` and Task 3.2's comments) can
 * import the access rules without pulling in the whole samples feature.
 *
 * `PrismaModule` is `@Global()`, so nothing else has to be imported here.
 */
@Module({
  providers: [SampleAccessService],
  exports: [SampleAccessService],
})
export class SamplesAccessModule {}
