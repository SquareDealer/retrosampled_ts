import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { UsersController } from './controller/users.controller';
import { ProfilesController } from './controller/profiles.controller';
import { UsersService } from './service/users.service';
import { AVATAR_STORAGE, LocalAvatarStorage } from './avatar-storage.service';
import { UploadsStaticMiddleware } from './uploads-static.middleware';

@Module({
  controllers: [UsersController, ProfilesController],
  providers: [
    UsersService,
    UploadsStaticMiddleware,
    { provide: AVATAR_STORAGE, useClass: LocalAvatarStorage },
  ],
  exports: [UsersService],
})
export class UsersModule implements NestModule {
  /**
   * `/uploads/*` → `LOCAL_STORAGE_DIR` (see UploadsStaticMiddleware). Nest
   * matches middleware routes exactly, hence the wildcard.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(UploadsStaticMiddleware)
      .forRoutes({ path: 'uploads/*', method: RequestMethod.GET });
  }
}
