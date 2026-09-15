# Retrosamples

## Структура
- `apps/frontend` — клиент (React + Vite)
- `apps/backend` — сервер (NestJS + Prisma/SQLite)
- `packages/shared` — общий пакет `@retrosampled/shared` (типы, enum-ы, `can()`)

## Быстрый старт
1. Установите pnpm (нужна версия из поля `packageManager` в корневом `package.json`).
   Если pnpm ругается на версию: `export npm_config_manage_package_manager_versions=false`.
2. Из корня репозитория выполните `pnpm install`.
3. Создайте файлы окружения из примеров:
   - `cp apps/backend/.env.example apps/backend/.env`
   - `cp apps/frontend/.env.example apps/frontend/.env` (необязательно, значения по умолчанию подходят для локальной разработки)
4. Сгенерируйте `JWT_SECRET` и впишите его в `apps/backend/.env`:
   ```sh
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
5. Примените миграции и заполните базу демо-данными:
   ```sh
   pnpm --filter @retrosampled/backend exec prisma migrate dev
   pnpm --filter @retrosampled/backend exec prisma db seed
   ```
   Сид идемпотентен (его можно запускать повторно) и создаёт 6 пользователей, 16 семплов
   (14 опубликованных, один DRAFT и один PROCESSING) с деревом ремейков, лайки, скачивания,
   подписки, комментарии с ответами и уведомления. Аудио копируется из
   `apps/frontend/public/audio` в хранилище (`apps/backend/uploads/`, в git не попадает).
6. `pnpm dev` — поднимет backend (http://localhost:3000) и frontend (http://localhost:5173).

### Тестовые аккаунты
После сидинга: `admin@example.com / admin123` (роль `ADMIN`) и
`southkid@example.com`, `bagamemphis@example.com`, `vhsghost@example.com`,
`nimbus@example.com`, `cassette@example.com` — все с паролем `user123`.

### Переменные окружения backend (`apps/backend/.env`)
| Переменная | По умолчанию | Назначение |
|---|---|---|
| `PORT` | `3000` | порт API |
| `CORS_ORIGIN` | `http://localhost:5173` | список origin'ов через запятую; распространяется и на `/uploads/*` |
| `DATABASE_URL` | `file:./dev.db` | SQLite (Prisma), путь относительно `apps/backend/prisma` |
| `JWT_SECRET` | — | обязателен; `JWT_ACCESS_TTL=900`, `JWT_REFRESH_TTL=2592000` (секунды) |
| `STORAGE_DRIVER` | `local` | `local` или `s3` (см. ниже) |
| `LOCAL_STORAGE_DIR` | `./uploads` | каталог локального драйвера, отдаётся как `${PUBLIC_BASE_URL}/uploads/` |
| `PUBLIC_BASE_URL` | `http://localhost:3000` | база для публичных URL аудио, пиков, обложек и аватаров |
| `MAX_UPLOAD_MB` | `50` | лимит аудиофайла |
| `PEAKS_DRIVER` | `native` | `native` (встроенный WAV-ридер) или `audiowaveform` (внешний бинарник) |

### Хранилище файлов
Все файлы (аудио `samples/{id}/audio.*`, пики `samples/{id}/peaks.json`, обложки
`samples/{id}/cover.*`, аватары `avatars/{userId}.*`) идут через один `StoragePort`:
- `STORAGE_DRIVER=local` — файлы в `LOCAL_STORAGE_DIR`, backend сам отдаёт их по `/uploads/*` с CORS для фронтенда.
- `STORAGE_DRIVER=s3` — любой S3-совместимый бакет (AWS, MinIO, R2, Supabase Storage):
  задайте `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`;
  опционально `S3_FORCE_PATH_STYLE=true` (MinIO) и `S3_PUBLIC_URL` (CDN/публичная база вместо URL бакета).
  Скачивания выдаются через подписанные URL.

### Frontend (`apps/frontend/.env`)
- `VITE_API_URL` — origin backend'а (по умолчанию `http://localhost:3000`).
- `VITE_USE_MOCKS=true` — работать на in-memory движках (`src/mocks/engine/*`) без backend'а;
  по умолчанию `false` — реальный API.

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
