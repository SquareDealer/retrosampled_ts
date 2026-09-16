# @retrosampled/backend

NestJS 10 API with Prisma + SQLite and a local JWT auth stub (no Supabase).

## Setup

```sh
pnpm install                                   # from the repo root
cp apps/backend/.env.example apps/backend/.env # then set JWT_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Database

```sh
pnpm --filter @retrosampled/backend exec prisma migrate dev   # apply / create migrations
pnpm --filter @retrosampled/backend exec prisma db seed       # demo users
pnpm --filter @retrosampled/backend exec prisma studio        # browse the data
```

The SQLite file lives at `prisma/dev.db` (gitignored); e2e tests use `prisma/test.db`,
recreated from the migrations by the Jest `globalSetup`.

Seeded accounts: `admin@example.com / admin123` (ADMIN) and `southkid`, `bagamemphis`,
`vhsghost`, `nimbus`, `cassette` (`<username>@example.com` / `user123`).

## Run

```sh
pnpm dev:backend                                  # nest start --watch, http://localhost:3000
pnpm --filter @retrosampled/backend test          # unit tests
pnpm --filter @retrosampled/backend test:e2e      # e2e tests
```

## Environment

See `.env.example`. `DATABASE_URL` and `JWT_SECRET` are required; the `S3_*` values are
required only when `STORAGE_DRIVER=s3`. `CORS_ORIGIN` is a comma-separated list of
origins allowed to send credentialed requests.

## Auth contract

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | `{email, password, username?}` → `{message:'Registered and logged in', user}` + cookies |
| POST | `/auth/login` | `{email, password}` → `{message:'Logged in', user, expiresIn}` |
| POST | `/auth/refresh` | refresh cookie → `{message:'Session refreshed', expiresIn}`, rotates the token |
| POST | `/auth/logout` | `{message:'Logged out'}`, revokes the token family, clears cookies |
| GET | `/auth/me` | `{user:{sub,id,email,username,displayName,avatarUrl,role}}` |
| POST | `/auth/change-password` | `{oldPassword,newPassword}`, revokes the other sessions |
| DELETE | `/auth/account` | `{password}`, soft delete (`isActive=false`) |

Access tokens are HS256 JWTs (`iss` `retrosampled`, `aud` `retrosampled-web`), sent as the
`access_token` cookie or an `Authorization: Bearer` header. Refresh tokens are opaque
(32 random bytes, sha256 at rest) and rotate on every refresh; replaying a rotated token
revokes the whole family.

Guards are global (`JwtAuthGuard` then `RolesGuard`): routes opt out with `@Public()`,
serve guests with `@OptionalAuth()`, and restrict roles with `@Roles('ADMIN')`.
`@CurrentUser()` injects `{sub, id, email, username, role}`.
