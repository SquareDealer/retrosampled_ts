import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SamplesService } from './samples.service';
import { QuerySamplesDto } from './dto/query-samples.dto';
import { JwtAuthGuard, AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';

@Controller('samples')
export class SamplesController {
  constructor(private readonly samples: SamplesService) {}

  @Get()
  @UseGuards(OptionalAuthGuard)
  feed(@Query() query: QuerySamplesDto, @Req() req: AuthenticatedRequest) {
    return this.samples.getFeed(query, req.user?.sub);
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  detail(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.samples.getDetail(id, req.user?.sub);
  }

  @Put(':id/like')
  @UseGuards(JwtAuthGuard)
  like(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.samples.like(id, req.user!.sub);
  }

  @Delete(':id/like')
  @UseGuards(JwtAuthGuard)
  unlike(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.samples.unlike(id, req.user!.sub);
  }

  @Post(':id/downloads')
  @UseGuards(JwtAuthGuard)
  download(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.samples.registerDownload(id, req.user!.sub);
  }

  @Post(':id/remakes')
  @UseGuards(JwtAuthGuard)
  remake(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.samples.createRemakeDraft(id, req.user!.sub);
  }

  @Patch(':id/visibility')
  @UseGuards(JwtAuthGuard)
  visibility(
    @Param('id') id: string,
    @Body() body: { status: 'published' | 'private' },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.samples.updateVisibility(id, req.user!.sub, body.status);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.samples.remove(id, req.user!.sub);
  }

  @Post(':id/retry-processing')
  @UseGuards(JwtAuthGuard)
  retry(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.samples.retryProcessing(id, req.user!.sub);
  }
}
