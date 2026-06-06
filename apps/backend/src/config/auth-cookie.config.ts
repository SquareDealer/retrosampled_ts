import { ConfigService } from '@nestjs/config';
import { CookieOptions } from 'express';

const REFRESH_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function baseCookieOptions(configService: ConfigService): CookieOptions {
  const isProd = configService.get<string>('NODE_ENV') === 'production';

  // When the SPA and API live on different domains, cookies must be
  // SameSite=None + Secure to be sent cross-site. Configurable via env so a
  // same-domain deployment can keep the safer `lax` default.
  const sameSite =
    (configService.get<string>('COOKIE_SAMESITE') as
      | 'lax'
      | 'strict'
      | 'none'
      | undefined) ?? 'lax';

  const secureEnv = configService.get<string>('COOKIE_SECURE');
  const secure =
    secureEnv !== undefined ? secureEnv === 'true' : isProd || sameSite === 'none';

  const domain = configService.get<string>('COOKIE_DOMAIN') || undefined;

  return {
    httpOnly: true,
    secure,
    sameSite,
    domain,
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
