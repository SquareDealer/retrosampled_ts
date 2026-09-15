# Retrosamples

## Структура
- `apps/frontend` — клиент (React + Vite)
- `apps/backend` — сервер (NestJS + Prisma/SQLite)
- `packages/shared` — общий пакет `@retrosampled/shared` (типы, enum-ы, `can()`)

## Быстрый старт
1. Установите pnpm (нужна версия из поля `packageManager` в корневом `package.json`).
2. Из корня репозитория выполните `pnpm install`.
3. Создайте файлы окружения из примеров:
   - `cp apps/backend/.env.example apps/backend/.env`
   - `cp apps/frontend/.env.example apps/frontend/.env` (необязательно, значения по умолчанию подходят для локальной разработки)
4. Сгенерируйте `JWT_SECRET` и впишите его в `apps/backend/.env`:
   ```sh
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
5. Примените миграции и заполните базу демо-пользователями:
   ```sh
   pnpm --filter @retrosampled/backend exec prisma migrate dev
   pnpm --filter @retrosampled/backend exec prisma db seed
   ```
6. `pnpm dev` — поднимет backend (http://localhost:3000) и frontend (http://localhost:5173).

Тестовые аккаунты после сидинга: `admin@example.com / admin123` (роль `ADMIN`) и
`southkid@example.com`, `bagamemphis@example.com`, `vhsghost@example.com`,
`nimbus@example.com`, `cassette@example.com` — все с паролем `user123`.

## Команды
- `pnpm dev` — запуск frontend и backend параллельно
- `pnpm dev:frontend` — запуск только frontend
- `pnpm dev:backend` — запуск только backend
- `pnpm build` — сборка shared-пакета и приложений через Turbo
- `pnpm lint` — линтинг всех пакетов через Turbo
- `pnpm test` — юнит-тесты всех пакетов через Turbo
- `pnpm typecheck` — проверка типов
- `pnpm --filter @retrosampled/backend test:e2e` — e2e-тесты backend (отдельная база `prisma/test.db`)

Подробности по backend (миграции, сид, переменные окружения) — в `apps/backend/README.md`.
