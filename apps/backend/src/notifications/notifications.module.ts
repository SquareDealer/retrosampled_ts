import { Module } from '@nestjs/common';
import { NotificationsController } from './controller/notifications.controller';
import { NotificationsService } from './service/notifications.service';

/**
 * Exports `NotificationsService` so the follows, comments and (Task 3.1a)
 * samples modules can emit notifications: import `NotificationsModule` and
 * inject the service, then call `notify({ userId, actorId, type, sampleId })`.
 */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
