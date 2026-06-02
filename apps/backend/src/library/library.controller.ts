import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { LibraryService } from './library.service';
import { QueryLibraryDto } from './dto/query-library.dto';
import { JwtAuthGuard, AuthenticatedRequest } from '../auth/jwt-auth.guard';

@Controller('library')
@UseGuards(JwtAuthGuard)
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get('items')
  items(@Query() query: QueryLibraryDto, @Req() req: AuthenticatedRequest) {
    return this.library.getItems(query, req.user!.sub);
  }

  @Get('continue-working')
  continueWorking(@Req() req: AuthenticatedRequest) {
    return this.library.continueWorking(req.user!.sub);
  }
}
