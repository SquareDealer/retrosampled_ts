import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from '../service/auth.service';
import { JwtAuthGuard, AuthenticatedRequest } from '../jwt-auth.guard';
import { RegisterDto } from '../dto/register.dto';
import { SignInDto } from '../dto/sign-in.dto';
import {
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
} from '../../config/auth-cookie.config';

// Tighter rate limit on auth endpoints to slow credential-stuffing.
@Throttle({
  default: {
    ttl: Number(process.env.THROTTLE_TTL ?? 60000),
    limit: Number(process.env.AUTH_THROTTLE_LIMIT ?? 50),
  },
})
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private setSessionCookies(
    res: Response,
    session: { access_token: string; refresh_token: string; expires_in: number },
  ): void {
    res.cookie(
      'access_token',
      session.access_token,
      getAccessTokenCookieOptions(this.configService, session.expires_in),
    );
    res.cookie(
      'refresh_token',
      session.refresh_token,
      getRefreshTokenCookieOptions(this.configService),
    );
  }

  // Регистрация нового пользователя
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, session } = await this.authService.signUp(
      dto.email,
      dto.password,
      dto.username,
    );
    this.setSessionCookies(res, session);

    return {
      message: 'Registered and logged in',
      user,
      expiresIn: session.expires_in,
    };
  }

  // Логин с паролем
  @Post('login')
  async login(
    @Body() dto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.authService.login(dto.email, dto.password);
    this.setSessionCookies(res, session);

    return {
      message: 'Logged in',
      user: session.user,
      expiresIn: session.expires_in,
    };
  }

  // Обновление сессии по refresh token
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token');
    }

    const session = await this.authService.refresh(refreshToken);
    this.setSessionCookies(res, session);

    return {
      message: 'Session refreshed',
      expiresIn: session.expires_in,
    };
  }

  // Логаут — отзываем refresh token и чистим cookies
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.cookies['refresh_token']);
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    return { message: 'Logged out' };
  }

  // Получить текущего пользователя (защищённый роут)
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: AuthenticatedRequest) {
    return { user: req.user };
  }

  // Запрос на сброс пароля
  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    if (!body.email) {
      throw new BadRequestException('Email is required');
    }
    await this.authService.forgotPassword(body.email);
    return { message: 'Password reset link sent to email' };
  }

  // Сброс пароля по токену из письма
  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    if (!body.token || !body.newPassword) {
      throw new BadRequestException('Token and newPassword are required');
    }
    await this.authService.resetPassword(body.token, body.newPassword);
    return { message: 'Password reset successfully' };
  }

  // Подтверждение email по токену из письма
  @Post('verify-email')
  async verifyEmail(@Body() body: { token: string }) {
    if (!body.token) {
      throw new BadRequestException('Token is required');
    }
    await this.authService.verifyEmail(body.token);
    return { message: 'Email verified' };
  }

  // Изменение пароля (для уже логиненного пользователя)
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(
    @Body() body: { oldPassword: string; newPassword: string },
    @Req() req: AuthenticatedRequest,
  ) {
    if (!body.oldPassword || !body.newPassword) {
      throw new BadRequestException('Old and new passwords are required');
    }
    await this.authService.changePassword(
      req.user!.sub,
      body.oldPassword,
      body.newPassword,
    );
    return { message: 'Password changed successfully' };
  }

  // Обновление учётных данных (email/пароль)
  @UseGuards(JwtAuthGuard)
  @Post('update-profile')
  async updateProfile(
    @Body() body: { email?: string; password?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.authService.updateUser(req.user!.sub, body);
    return { message: 'Profile updated', user: result };
  }

  // Удаление аккаунта
  @UseGuards(JwtAuthGuard)
  @Post('delete-account')
  async deleteAccount(
    @Body() body: { password: string },
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!body.password) {
      throw new BadRequestException('Password is required');
    }
    await this.authService.deleteUser(req.user!.sub, body.password);
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    return { message: 'Account deleted successfully' };
  }

  // Повторная отправка письма подтверждения
  @UseGuards(JwtAuthGuard)
  @Post('send-verification-email')
  async sendVerificationEmail(@Req() req: AuthenticatedRequest) {
    await this.authService.sendVerificationEmail(req.user!.sub);
    return { message: 'Verification email sent' };
  }
}
