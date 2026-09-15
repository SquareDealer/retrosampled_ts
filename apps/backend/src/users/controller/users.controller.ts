import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { UsersService } from '../service/users.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { OptionalAuth } from '../../common/decorators/optional-auth.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/authenticated-request';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  async updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateUserDto) {
    return this.usersService.updateMe(user.id, dto);
  }

  @OptionalAuth()
  @Get(':username')
  async getByUsername(
    @Param('username') username: string,
    @CurrentUser() viewer: RequestUser | undefined,
  ) {
    return this.usersService.getPublicUser(username, viewer?.id);
  }
}
