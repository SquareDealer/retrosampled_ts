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

  // Browsers reject SameSite=None cookies without Secure, so force it on in
  // that case regardless of COOKIE_SECURE to avoid silently-dropped cookies.
  const secureEnv = configService.get<string>('COOKIE_SECURE');
  const secure =
    sameSite === 'none'
      ? true
      : secureEnv !== undefined
        ? secureEnv === 'true'
        : isProd;

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

// clearCookie only deletes a cookie when domain/sameSite/secure/path match the
// attributes it was set with — so reuse the same base options when clearing.
export function getClearCookieOptions(
  configService: ConfigService,
): CookieOptions {
  return baseCookieOptions(configService);
}
