import { Controller, Get, Body, Patch, Param, UseGuards, Req } from '@nestjs/common';
import { ProfileService } from '../service/profile.service';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { Request } from 'express';

@Controller('profiles')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  // Публичный роут: просмотр чужого профиля по username
  @Get(':username')
  async getPublicProfile(@Param('username') username: string) {
    return this.profileService.getProfileByUsername(username);
  }

  // Приватный роут: получение своего профиля
  @UseGuards(SupabaseAuthGuard)
  @Get('me/details')
  async getMyProfile(@Req() req: Request) {
    const userId = (req as any).user.sub; // sub - это user_id из JWT токена Supabase
    return this.profileService.getProfileById(userId);
  }

  // Приватный роут: обновление профиля
  @UseGuards(SupabaseAuthGuard)
  @Patch('me')
  async updateMyProfile(
    @Req() req: Request,
    @Body() dto: UpdateProfileDto
  ) {
    const userId = (req as any).user.sub;
    return this.profileService.updateProfile(userId, dto);
  }
}