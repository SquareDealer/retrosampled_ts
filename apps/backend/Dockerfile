# Multi-stage build for the NestJS backend.
# Build context must be the repository root (monorepo), e.g.:
#   docker build -f apps/backend/Dockerfile -t retrosamples-api .

FROM node:20-slim AS build
RUN apt-get update && apt-get install -y openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

# Copy the workspace (node_modules/dist excluded via .dockerignore) and install
# only the backend and its dependencies.
COPY . .
RUN pnpm install --frozen-lockfile --filter @retrosampled/backend...
RUN pnpm --filter @retrosampled/backend prisma:generate
RUN pnpm --filter @retrosampled/backend build

# ---------------------------------------------------------------------------
FROM node:20-slim AS runner
RUN apt-get update && apt-get install -y openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app /app
WORKDIR /app/apps/backend

EXPOSE 3000
# Apply migrations, then start. DATABASE_URL / JWT_SECRET come from the env.
CMD ["sh", "-c", "pnpm prisma:deploy && node dist/main"]
