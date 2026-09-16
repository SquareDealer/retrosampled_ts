import { Controller, Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/authenticated-request';
import { FollowsService } from '../service/follows.service';

@Controller('users')
export class FollowsController {
  constructor(private readonly follows: FollowsService) {}

  @HttpCode(HttpStatus.OK)
  @Post(':id/follow')
  follow(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.follows.follow(user.id, id);
  }

  @HttpCode(HttpStatus.OK)
  @Delete(':id/follow')
  unfollow(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.follows.unfollow(user.id, id);
  }
}
