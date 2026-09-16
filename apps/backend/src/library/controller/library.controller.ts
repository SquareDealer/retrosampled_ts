import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/authenticated-request';
import { LibraryQueryDto } from '../dto/library-query.dto';
import { LibraryService } from '../service/library.service';

@Controller('library')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get('items')
  items(@CurrentUser() user: RequestUser, @Query() query: LibraryQueryDto) {
    return this.library.getItems(user.id, { tab: query.tab ?? 'liked', ...query });
  }

  @Get('continue-working')
  async continueWorking(@CurrentUser() user: RequestUser) {
    return { items: await this.library.getContinueWorking(user.id) };
  }
}
