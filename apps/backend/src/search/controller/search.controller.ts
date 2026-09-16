import { Controller, Get, Query } from '@nestjs/common';
import { OptionalAuth } from '../../common/decorators/optional-auth.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/authenticated-request';
import { SearchQueryDto } from '../dto/search-query.dto';
import { SearchService } from '../service/search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @OptionalAuth()
  @Get()
  search(@Query() query: SearchQueryDto, @CurrentUser() viewer: RequestUser | undefined) {
    return this.searchService.search(query.q, query.type ?? 'all', query.limit, viewer?.id);
  }
}
