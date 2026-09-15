import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { OptionalAuth } from '../../common/decorators/optional-auth.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/authenticated-request';
import { toActor } from '../service/sample-access.service';
import { CommentsService } from '../service/comments.service';
import { CreateCommentDto, ListCommentsQueryDto, UpdateCommentDto } from '../dto/comment.dto';

/** `GET|POST /samples/:id/comments` and `PATCH|DELETE /comments/:id`. */
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @OptionalAuth()
  @Get('samples/:id/comments')
  list(
    @Param('id') sampleId: string,
    @Query() query: ListCommentsQueryDto,
    @CurrentUser() user: RequestUser | undefined,
  ) {
    return this.comments.list(sampleId, toActor(user), query);
  }

  @Post('samples/:id/comments')
  create(
    @Param('id') sampleId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.comments.create(sampleId, toActor(user), dto.text, dto.parentId);
  }

  @Patch('comments/:id')
  update(
    @Param('id') commentId: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.comments.update(commentId, toActor(user), dto.text);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('comments/:id')
  async remove(@Param('id') commentId: string, @CurrentUser() user: RequestUser) {
    await this.comments.remove(commentId, toActor(user));
  }
}
