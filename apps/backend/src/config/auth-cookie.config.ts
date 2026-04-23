import { ConfigService } from '@nestjs/config';
import { CookieOptions } from 'express';

const REFRESH_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function baseCookieOptions(configService: ConfigService): CookieOptions {
  return {
    httpOnly: true,
    secure: configService.get<string>('NODE_ENV') === 'production',
    sameSite: 'lax',
    path: '/',
  };
}

export function getAccessTokenCookieOptions(
  configService: ConfigService,
  expiresInSeconds: number,
): CookieOptions {
  return {
    ...baseCookieOptions(configService),
    maxAge: expiresInSeconds * 1000,
  };
}

export function getRefreshTokenCookieOptions(
  configService: ConfigService,
): CookieOptions {
  return {
    ...baseCookieOptions(configService),
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  };
}
