import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

/**
 * Boots the full application the same way `main.ts` does, so e2e tests exercise
 * the real middleware stack (cookies, validation pipe, exception filter).
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.init();
  return app;
}

/** Extracts a cookie value from a supertest Set-Cookie header array. */
export function readCookie(
  setCookie: string[] | undefined,
  name: string,
): string | undefined {
  if (!setCookie) return undefined;
  const match = setCookie.find((c) => c.startsWith(`${name}=`));
  if (!match) return undefined;
  return match.split(';')[0].split('=')[1];
}
