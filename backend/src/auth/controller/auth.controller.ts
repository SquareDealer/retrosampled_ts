import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from '../service/auth.service';
import { SupabaseAuthGuard } from '../supabase-auth.guard';
import { RegisterDto } from '../dto/register.dto';
import { SignInDto } from '../dto/singn-in.dto';

// Cookie options for secure session storage
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Регистрация нового пользователя
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.signUp(dto.email, dto.password);

    // Если Supabase сразу выдал сессию (email confirmation отключен)
    if (result.session) {
      res.cookie('access_token', result.session.access_token, {
        ...COOKIE_OPTIONS,
        maxAge: result.session.expires_in * 1000,
      });
      res.cookie('refresh_token', result.session.refresh_token, {
        ...COOKIE_OPTIONS,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
    }

    return {
      message: result.session
        ? 'Registered and logged in'
        : 'Confirmation email sent',
      user: result.user,
    };
  }

  // Логин с паролем
  @Post('login')
  async login(
    @Body() dto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.authService.loginWithPassword(
      dto.email,
      dto.password,
    );

    res.cookie('access_token', session.access_token, {
      ...COOKIE_OPTIONS,
      maxAge: session.expires_in * 1000,
    });
    res.cookie('refresh_token', session.refresh_token, {
      ...COOKIE_OPTIONS,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

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
      return { error: 'No refresh token' };
    }

    const session = await this.authService.refresh(refreshToken);

    res.cookie('access_token', session.access_token, {
      ...COOKIE_OPTIONS,
      maxAge: session.expires_in * 1000,
    });
    res.cookie('refresh_token', session.refresh_token, {
      ...COOKIE_OPTIONS,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return {
      message: 'Session refreshed',
      expiresIn: session.expires_in,
    };
  }

  // Логаут — удаляем cookies
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const accessToken = req.cookies['access_token'];
    if (accessToken) {
      await this.authService.signOut(accessToken);
    }
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    return { message: 'Logged out' };
  }

  // Получить текущего пользователя (защищённый роут)
  @UseGuards(SupabaseAuthGuard)
  @Get('me')
  async me(@Req() req: Request) {
    console.log('req.user in controller:', (req as any).user);
    // req.user заполняется в SupabaseAuthGuard
    return { user: (req as any).user };
  }

  // Запрос на сброс пароля
  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    if (!body.email) {
      throw new BadRequestException('Email is required');
    }
    await this.authService.resetPasswordForEmail(body.email);
    return { message: 'Password reset link sent to email' };
  }

  // Сброс пароля по токену из письма
  @Post('reset-password')
  async resetPassword(
    @Body() body: { token: string; newPassword: string },
  ) {
    if (!body.token || !body.newPassword) {
      throw new BadRequestException('Token and newPassword are required');
    }
    await this.authService.resetPasswordWithToken(body.token, body.newPassword);
    return { message: 'Password reset successfully' };
  }

  // Изменение пароля (для уже логиненного пользователя)
  @UseGuards(SupabaseAuthGuard)
  @Post('change-password')
  async changePassword(
    @Body() body: { oldPassword: string; newPassword: string },
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    if (!body.oldPassword || !body.newPassword) {
      throw new BadRequestException('Old and new passwords are required');
    }
    await this.authService.changePassword(
      user.email,
      body.oldPassword,
      body.newPassword,
    );
    return { message: 'Password changed successfully' };
  }

  // Обновление профиля (email, данные)
  @UseGuards(SupabaseAuthGuard)
  @Post('update-profile')
  async updateProfile(
    @Body() body: { email?: string; password?: string },
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const result = await this.authService.updateUser(user.sub, body);
    return { message: 'Profile updated', user: result };
  }

  // Удаление аккаунта
  @UseGuards(SupabaseAuthGuard)
  @Post('delete-account')
  async deleteAccount(
    @Body() body: { password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = (req as any).user;
    if (!body.password) {
      throw new BadRequestException('Password is required');
    }
    await this.authService.deleteUser(user.email, body.password);
    
    // Очистить cookies
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    
    return { message: 'Account deleted successfully' };
  }

  // Отправка письма подтверждения (для смены email)
  @UseGuards(SupabaseAuthGuard)
  @Post('send-verification-email')
  async sendVerificationEmail(@Req() req: Request) {
    const user = (req as any).user;
    await this.authService.sendVerificationEmail(user.email);
    return { message: 'Verification email sent' };
  }
}
