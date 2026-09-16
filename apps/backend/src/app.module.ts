import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AdminModule } from './admin/admin.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { validateEnv } from './config/env.validation';
import { StorageModule } from './storage/storage.module';
import { UploadsModule } from './uploads/uploads.module';
import { SamplesModule } from './samples/samples.module';
import { SampleDeletionHookModule } from './samples/sample-deletion-hook.module';
import { FollowsModule } from './follows/follows.module';
import { NotificationsModule } from './notifications/notifications.module';
import { LibraryModule } from './library/library.module';
import { SearchModule } from './search/search.module';
import { CommentsModule } from './samples/comments.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    // Task 2 appends: AdminModule
    AdminModule,
    // Task 3.1a appends: StorageModule, UploadsModule, SamplesModule
    StorageModule,
    UploadsModule,
    SampleDeletionHookModule,
    SamplesModule,
    // Task 3.2 appends: FollowsModule, NotificationsModule, LibraryModule, SearchModule
    FollowsModule,
    NotificationsModule,
    LibraryModule,
    SearchModule,
    CommentsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Authentication runs first, then role checks; routes opt out with
    // @Public() / @OptionalAuth().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
