import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CreatorsController } from './controller/creators.controller';
import { CreatorsService } from './service/creators.service';

@Module({
  imports: [AuthModule],
  controllers: [CreatorsController],
  providers: [CreatorsService],
})
export class CreatorsModule {}
