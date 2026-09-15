import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

export type Cookies = Record<string, string>;

export function parseCookies(response: request.Response): Cookies {
  const raw = response.headers['set-cookie'] as unknown;
  const list = Array.isArray(raw) ? (raw as string[]) : typeof raw === 'string' ? [raw] : [];
  const cookies: Cookies = {};

  for (const cookie of list) {
    const pair = cookie.split(';')[0];
    const index = pair.indexOf('=');
    cookies[pair.slice(0, index)] = pair.slice(index + 1);
  }

  return cookies;
}

export function cookieHeader(cookies: Cookies): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

/** Boots the whole app exactly like `main.ts` (pipes, filter, cookies). */
export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleFixture.createNestApplication();

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.init();
  return app;
}

export type Session = { id: string; username: string; cookies: Cookies };

export async function registerUser(
  server: ReturnType<INestApplication['getHttpServer']>,
  email: string,
  username: string,
  password = 'secret123',
): Promise<Session> {
  const response = await request(server)
    .post('/auth/register')
    .send({ email, password, username })
    .expect(201);

  return {
    id: response.body.user.id as string,
    username: response.body.user.username as string,
    cookies: parseCookies(response),
  };
}
