import { Module } from '@nestjs/common';
import { SearchController } from './controller/search.controller';
import { SearchService } from './service/search.service';

@Module({
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
