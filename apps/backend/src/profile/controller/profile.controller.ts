import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ProfileService } from '../service/profile.service';
import { JwtAuthGuard, AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { UpdateProfileDto } from '../dto/update-profile.dto';

@Controller('profiles')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  // Приватный роут: получение своего профиля
  @UseGuards(JwtAuthGuard)
  @Get('me/details')
  async getMyProfile(@Req() req: AuthenticatedRequest) {
    return this.profileService.getProfileById(req.user!.sub);
  }

  // Приватный роут: обновление профиля
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMyProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(req.user!.sub, dto);
  }

  // Публичный роут: просмотр чужого профиля по username
  @Get(':username')
  async getPublicProfile(@Param('username') username: string) {
    return this.profileService.getProfileByUsername(username);
  }
}
