type EnvConfig = {
  NODE_ENV?: string;
  PORT?: string | number;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_KEY?: string;
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

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
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

  if (!env.SUPABASE_URL) {
    errors.push('SUPABASE_URL is required');
  } else {
    try {
      // Ensure valid URL format before app startup.
      new URL(env.SUPABASE_URL);
    } catch {
      errors.push('SUPABASE_URL must be a valid URL');
    }
  }

  if (!env.SUPABASE_ANON_KEY && !env.SUPABASE_KEY) {
    errors.push('SUPABASE_ANON_KEY or SUPABASE_KEY is required');
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed: ${errors.join('; ')}`);
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    PORT: parsePort(env.PORT),
  };
}
