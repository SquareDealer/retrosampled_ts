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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AVATAR_MAX_BYTES, UsersService } from '../service/users.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { ListUsersQueryDto, SearchUsersQueryDto } from '../dto/list-users-query.dto';
import { OptionalAuth } from '../../common/decorators/optional-auth.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/authenticated-request';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Declared before `:username` so "search" is never treated as a handle. */
  @OptionalAuth()
  @Get('search')
  search(@Query() query: SearchUsersQueryDto, @CurrentUser() viewer: RequestUser | undefined) {
    return this.usersService.search(query.q, query.limit, viewer?.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateUserDto) {
    return this.usersService.updateMe(user.id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: AVATAR_MAX_BYTES, files: 1 },
    }),
  )
  uploadAvatar(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.usersService.setAvatar(user.id, file);
  }

  @HttpCode(HttpStatus.OK)
  @Delete('me/avatar')
  removeAvatar(@CurrentUser() user: RequestUser) {
    return this.usersService.removeAvatar(user.id);
  }

  @OptionalAuth()
  @Get(':username')
  getByUsername(
    @Param('username') username: string,
    @CurrentUser() viewer: RequestUser | undefined,
  ) {
    return this.usersService.getPublicUser(username, viewer?.id);
  }

  @OptionalAuth()
  @Get(':username/followers')
  followers(
    @Param('username') username: string,
    @Query() query: ListUsersQueryDto,
    @CurrentUser() viewer: RequestUser | undefined,
  ) {
    return this.usersService.listFollowers(username, query, viewer?.id);
  }

  @OptionalAuth()
  @Get(':username/following')
  following(
    @Param('username') username: string,
    @Query() query: ListUsersQueryDto,
    @CurrentUser() viewer: RequestUser | undefined,
  ) {
    return this.usersService.listFollowing(username, query, viewer?.id);
  }
}
