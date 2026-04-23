import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthController } from './auth/controller/auth.controller';
import { AuthService } from './auth/service/auth.service';
import { ProfileController } from './profile/controller/profile.controller';
import { ProfileService } from './profile/service/profile.service';
import { CreatorsService } from './creators/service/creators.service';
import { CreatorsController } from './creators/controller/creators.controller';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
  ],
  controllers: [
    AppController, 
    AuthController,
    ProfileController,
    CreatorsController
  ],
  providers: [AppService, AuthService, ProfileService, CreatorsService],
})
export class AppModule {}