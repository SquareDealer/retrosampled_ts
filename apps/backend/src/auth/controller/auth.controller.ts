import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService, AuthSession } from '../service/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { DeleteAccountDto } from '../dto/delete-account.dto';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalAuth } from '../../common/decorators/optional-auth.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/authenticated-request';
import {
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
} from '../../config/auth-cookie.config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private setSessionCookies(res: Response, session: AuthSession): void {
    res.cookie(
      'access_token',
      session.accessToken,
      getAccessTokenCookieOptions(this.configService, session.expiresIn),
    );
    res.cookie(
      'refresh_token',
      session.refreshToken,
      getRefreshTokenCookieOptions(this.configService),
    );
  }

  private clearSessionCookies(res: Response): void {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
  }

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.authService.register(
      dto.email,
      dto.password,
      dto.username,
    );

    this.setSessionCookies(res, session);

    return {
      message: 'Registered and logged in',
      user: {
        id: session.user.id,
        email: session.user.email,
        username: session.user.username,
        role: session.user.role,
      },
    };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const session = await this.authService.login(dto.email, dto.password);

    this.setSessionCookies(res, session);

    return {
      message: 'Logged in',
      user: session.user,
      expiresIn: session.expiresIn,
    };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = (req.cookies as Record<string, string> | undefined)?.[
      'refresh_token'
    ];

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token');
    }

    const session = await this.authService.refresh(refreshToken);

    this.setSessionCookies(res, session);

    return {
      message: 'Session refreshed',
      expiresIn: session.expiresIn,
    };
  }

  @OptionalAuth()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = (req.cookies as Record<string, string> | undefined)?.[
      'refresh_token'
    ];

    await this.authService.logout(refreshToken);
    this.clearSessionCookies(res);

    return { message: 'Logged out' };
  }

  @Get('me')
  async me(@CurrentUser() user: RequestUser) {
    return { user: await this.authService.me(user.id) };
  }

  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    await this.authService.changePassword(
      user.id,
      dto.oldPassword,
      dto.newPassword,
      (req.cookies as Record<string, string> | undefined)?.['refresh_token'],
    );

    return { message: 'Password changed successfully' };
  }

  @HttpCode(HttpStatus.OK)
  @Delete('account')
  async deleteAccount(
    @CurrentUser() user: RequestUser,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.deleteAccount(user.id, dto.password);
    this.clearSessionCookies(res);

    return { message: 'Account deleted successfully' };
  }
}
