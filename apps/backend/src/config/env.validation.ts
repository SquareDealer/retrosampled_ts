type EnvConfig = {
  NODE_ENV?: string;
  PORT?: string | number;
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  JWT_ACCESS_TTL?: string | number;
  JWT_REFRESH_TTL?: string | number;
  APP_URL?: string;
};

const VALID_NODE_ENVS = new Set(['development', 'test', 'production']);

function parsePort(value: unknown): number {
  if (value == null || value === '') {
    return 3000;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return parsed;
}

function parsePositiveInt(value: unknown, fallback: number, name: string): number {
  if (value == null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const env = config as EnvConfig;
  const errors: string[] = [];

  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!VALID_NODE_ENVS.has(nodeEnv)) {
    errors.push('NODE_ENV must be one of: development, test, production');
  }

  try {
    parsePort(env.PORT);
  } catch (error) {
    errors.push((error as Error).message);
  }

  if (!env.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  } else if (!/^postgres(ql)?:\/\//.test(env.DATABASE_URL)) {
    errors.push('DATABASE_URL must be a postgres:// connection string');
  }

  if (!env.JWT_SECRET) {
    errors.push('JWT_SECRET is required');
  } else if (env.JWT_SECRET.length < 16) {
    errors.push('JWT_SECRET must be at least 16 characters');
  }

  let accessTtl = 3600;
  let refreshTtl = 60 * 60 * 24 * 30;
  try {
    accessTtl = parsePositiveInt(env.JWT_ACCESS_TTL, 3600, 'JWT_ACCESS_TTL');
  } catch (error) {
    errors.push((error as Error).message);
  }
  try {
    refreshTtl = parsePositiveInt(
      env.JWT_REFRESH_TTL,
      60 * 60 * 24 * 30,
      'JWT_REFRESH_TTL',
    );
  } catch (error) {
    errors.push((error as Error).message);
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed: ${errors.join('; ')}`);
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    PORT: parsePort(env.PORT),
    JWT_ACCESS_TTL: accessTtl,
    JWT_REFRESH_TTL: refreshTtl,
    APP_URL: env.APP_URL ?? 'http://localhost:5173',
  };
}
