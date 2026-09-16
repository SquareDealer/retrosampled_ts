import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { FollowsController } from './controller/follows.controller';
import { FollowsService } from './service/follows.service';

@Module({
  imports: [NotificationsModule],
  controllers: [FollowsController],
  providers: [FollowsService],
  exports: [FollowsService],
})
export class FollowsModule {}
