# Retrosamples

## Структура
- `apps/frontend` — клиент (React + Vite)
- `apps/backend` — сервер (NestJS)
- `packages` — общие пакеты (подготовлено для shared-types/config)

## Быстрый старт
1. Установите pnpm (если еще не установлен)
2. Из корня репозитория выполните `pnpm install`
3. Создайте `apps/backend/.env` (или проверьте, что он заполнен) с обязательными переменными:
	- `SUPABASE_URL`
	- `SUPABASE_ANON_KEY` или `SUPABASE_KEY`

## Команды
- `pnpm dev` — запуск frontend и backend параллельно
- `pnpm dev:frontend` — запуск только frontend
- `pnpm dev:backend` — запуск только backend
- `pnpm build` — сборка всех приложений через Turbo
- `pnpm lint` — линтинг всех приложений через Turbo
- `pnpm test` — запуск тестов всех приложений через Turbo