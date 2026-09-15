import { Module } from '@nestjs/common';
import { LibraryController } from './controller/library.controller';
import { LibraryService } from './service/library.service';

/** Exports `LibraryService` so the sample detail endpoint can call `touch()`. */
@Module({
  controllers: [LibraryController],
  providers: [LibraryService],
  exports: [LibraryService],
})
export class LibraryModule {}
