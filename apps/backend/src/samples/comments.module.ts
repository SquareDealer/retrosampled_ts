import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SamplesAccessModule } from './samples-access.module';
import { CommentsController } from './controller/comments.controller';
import { CommentsService } from './service/comments.service';

/**
 * Kept apart from Task 3.1a's `SamplesModule` so the two branches do not edit
 * the same module file. Both are imported side by side in `app.module.ts`.
 */
@Module({
  imports: [SamplesAccessModule, NotificationsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
