# Retrosamples

## Структура
- `apps/frontend` — клиент (React + Vite)
- `apps/backend` — сервер (NestJS + Prisma + PostgreSQL)
- `packages` — общие пакеты (подготовлено для shared-types/config)

## Быстрый старт
1. Установите pnpm (если еще не установлен)
2. Из корня репозитория выполните `pnpm install`
3. Поднимите локальный PostgreSQL:
   ```bash
   docker compose up -d
   ```
   (или используйте существующий кластер Postgres 16 на `localhost:5432`)
4. Создайте `apps/backend/.env` на основе `apps/backend/.env.example`. Ключевые переменные:
   - `DATABASE_URL` — строка подключения к Postgres
   - `JWT_SECRET` — секрет для подписи access/refresh токенов (≥ 16 символов)
   - `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `APP_URL`
5. Примените миграции и засейте демо-данные:
   ```bash
   pnpm --filter @retrosampled/backend prisma:migrate
   pnpm --filter @retrosampled/backend db:seed
   ```
6. (Опционально) Создайте `apps/frontend/.env` с `VITE_API_URL=http://localhost:3000`.

Демо-аккаунт после сидирования: `you@retrosamples.dev` / `password123`
(а также креаторы вида `southkid@retrosamples.dev` с тем же паролем).

## База данных
- Схема описана в `apps/backend/prisma/schema.prisma`.
- Аутентификация — собственная (bcrypt + JWT HS256, refresh-токены в БД).
  Supabase больше не используется.
- Письма (верификация / сброс пароля) в dev-режиме логируются в консоль сервера
  (см. `MailService`).

### Команды Prisma (через `pnpm --filter @retrosampled/backend ...`)
- `prisma:migrate` — создать/применить миграции (dev)
- `prisma:deploy` — применить миграции (prod/CI)
- `db:seed` — засеять демо-данные
- `db:reset` — сбросить БД и пересоздать (с сидом)

## Команды
- `pnpm dev` — запуск frontend и backend параллельно
- `pnpm dev:frontend` — запуск только frontend
- `pnpm dev:backend` — запуск только backend
- `pnpm build` — сборка всех приложений через Turbo
- `pnpm lint` — линтинг всех приложений через Turbo
- `pnpm test` — запуск тестов всех приложений через Turbo

## Тесты
- **Backend (Jest):**
  - `pnpm --filter @retrosampled/backend test` — юнит-тесты (без БД): валидация
    env, TokenService, гварды, сервисы (Prisma замокан).
  - `pnpm --filter @retrosampled/backend test:e2e` — e2e против реального
    Postgres. Требуется тестовая БД `retrosamples_test` (создаётся автоматически
    в CI; локально — `createdb retrosamples_test`). Перед прогоном применяются
    миграции и сид (`test/global-setup.js`). Строку подключения можно переопределить
    через `DATABASE_URL_TEST`.
- **Frontend (Vitest):** `pnpm --filter @retrosampled/frontend test` — утилиты и
  API-слой (включая fallback на моки при недоступном бэкенде).

## CI
GitHub Actions (`.github/workflows/ci.yml`) на каждый push в `main` и PR:
- **backend** — typecheck, юнит-тесты, e2e (с сервис-контейнером Postgres), build;
- **frontend** — typecheck, юнит-тесты Vitest, build.

## Деплой
См. **[DEPLOY.md](./DEPLOY.md)** — рекомендованный стек (Render + Cloudflare R2 +
Resend), `render.yaml` Blueprint, Dockerfile и нужные переменные окружения
(CORS/cookie для кросс-домена, хранилище, почта, rate-limit). Полный список
переменных — в `apps/backend/.env.example`.

## API (backend)
- `POST /auth/register|login|refresh|logout` — сессии (cookie access/refresh)
- `POST /auth/forgot-password|reset-password|verify-email|change-password`
- `GET /auth/me`, `POST /auth/update-profile|delete-account`
- `GET /profiles/:username`, `GET /profiles/me/details`, `PATCH /profiles/me`
- `POST /creators/become`
- `GET /samples` — лента (поиск, фильтры, сортировка, курсор-пагинация)
- `GET /samples/:id` — детальная страница с деревом сэмплирования
- `PUT|DELETE /samples/:id/like`, `POST /samples/:id/downloads|remakes|retry-processing`
- `PATCH /samples/:id/visibility`, `DELETE /samples/:id`
- `POST /samples` — загрузка сэмпла/римейка (multipart: аудио + waveform-пики)
- `PATCH /samples/:id` — редактирование метаданных (владелец)
- `GET /samples/:id/comments`, `POST /samples/:id/comments`, `DELETE /comments/:id`
- `PUT /creators/:id/follow`, `DELETE /creators/:id/follow`
- `GET /library/items` — личная библиотека (tabs: liked/downloaded/uploads/remakes)
- `GET /library/continue-working`
- `GET /health` — статус сервиса и БД
