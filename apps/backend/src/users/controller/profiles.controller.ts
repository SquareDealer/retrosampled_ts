import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { UsersService } from '../service/users.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/authenticated-request';

/**
 * Legacy `/profiles/*` surface kept as a thin alias over `/users/*` so existing
 * clients keep working. It returns the old ProfileResponseDto shape. Task 3.2
 * removes it once the frontend has migrated to `/users/*`.
 */
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  async updateMyProfile(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateMyProfile(user.id, dto);
  }

  @Public()
  @Get(':username')
  async getPublicProfile(@Param('username') username: string) {
    return this.usersService.getProfile(username);
  }
}
