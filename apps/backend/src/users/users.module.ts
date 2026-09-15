import { Module } from '@nestjs/common';
import { UsersController } from './controller/users.controller';
import { ProfilesController } from './controller/profiles.controller';
import { UsersService } from './service/users.service';

@Module({
  controllers: [UsersController, ProfilesController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
