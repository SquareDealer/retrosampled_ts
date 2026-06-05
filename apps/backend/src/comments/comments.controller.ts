import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard, AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';

@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('samples/:sampleId/comments')
  @UseGuards(OptionalAuthGuard)
  list(
    @Param('sampleId') sampleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.comments.list(sampleId, req.user?.sub);
  }

  @Post('samples/:sampleId/comments')
  @UseGuards(JwtAuthGuard)
  create(
    @Param('sampleId') sampleId: string,
    @Body() dto: CreateCommentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.comments.create(sampleId, req.user!.sub, dto);
  }

  @Delete('comments/:id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.comments.remove(id, req.user!.sub);
    return { message: 'Comment deleted' };
  }
}
