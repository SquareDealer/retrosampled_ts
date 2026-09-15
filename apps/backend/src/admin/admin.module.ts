import { Module } from '@nestjs/common';
import { SamplesAccessModule } from '../samples/samples-access.module';
import { AdminController } from './controller/admin.controller';
import { AdminService } from './service/admin.service';

@Module({
  imports: [SamplesAccessModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
