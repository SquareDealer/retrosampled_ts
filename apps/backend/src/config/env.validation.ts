const VALID_NODE_ENVS = new Set(['development', 'test', 'production']);
const VALID_STORAGE_DRIVERS = new Set(['local', 's3']);
const VALID_PEAKS_DRIVERS = new Set(['native', 'audiowaveform']);

const DEFAULTS = {
  PORT: 3000,
  CORS_ORIGIN: 'http://localhost:5173',
  JWT_ACCESS_TTL: 900,
  JWT_REFRESH_TTL: 2592000,
  STORAGE_DRIVER: 'local',
  LOCAL_STORAGE_DIR: './uploads',
  PUBLIC_BASE_URL: 'http://localhost:3000',
  PEAKS_DRIVER: 'native',
  MAX_UPLOAD_MB: 50,
} as const;

function parseInteger(
  value: unknown,
  name: string,
  fallback: number,
  { min, max }: { min: number; max: number },
): number {
  if (value == null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }

  return parsed;
}

/**
 * Validates and normalizes the environment. Only `DATABASE_URL` and `JWT_SECRET`
 * are strictly required (plus the S3 credentials when `STORAGE_DRIVER=s3`);
 * everything else falls back to a development-friendly default.
 */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const env = config as Record<string, string | undefined>;
  const errors: string[] = [];

  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!VALID_NODE_ENVS.has(nodeEnv)) {
    errors.push('NODE_ENV must be one of: development, test, production');
  }

  let port: number = DEFAULTS.PORT;
  let accessTtl: number = DEFAULTS.JWT_ACCESS_TTL;
  let refreshTtl: number = DEFAULTS.JWT_REFRESH_TTL;
  let maxUploadMb: number = DEFAULTS.MAX_UPLOAD_MB;

  const numeric: Array<[() => number, (value: number) => void]> = [
    [
      () => parseInteger(env.PORT, 'PORT', DEFAULTS.PORT, { min: 1, max: 65535 }),
      (value) => (port = value),
    ],
    [
      () =>
        parseInteger(env.JWT_ACCESS_TTL, 'JWT_ACCESS_TTL', DEFAULTS.JWT_ACCESS_TTL, {
          min: 60,
          max: 86400,
        }),
      (value) => (accessTtl = value),
    ],
    [
      () =>
        parseInteger(
          env.JWT_REFRESH_TTL,
          'JWT_REFRESH_TTL',
          DEFAULTS.JWT_REFRESH_TTL,
          { min: 3600, max: 31536000 },
        ),
      (value) => (refreshTtl = value),
    ],
    [
      () =>
        parseInteger(env.MAX_UPLOAD_MB, 'MAX_UPLOAD_MB', DEFAULTS.MAX_UPLOAD_MB, {
          min: 1,
          max: 1024,
        }),
      (value) => (maxUploadMb = value),
    ],
  ];

  for (const [read, assign] of numeric) {
    try {
      assign(read());
    } catch (error) {
      errors.push((error as Error).message);
    }
  }

  if (!env.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  }

  if (!env.JWT_SECRET) {
    errors.push('JWT_SECRET is required');
  } else if (env.JWT_SECRET.length < 16) {
    errors.push('JWT_SECRET must be at least 16 characters');
  }

  const storageDriver = env.STORAGE_DRIVER ?? DEFAULTS.STORAGE_DRIVER;
  if (!VALID_STORAGE_DRIVERS.has(storageDriver)) {
    errors.push('STORAGE_DRIVER must be one of: local, s3');
  }

  const peaksDriver = env.PEAKS_DRIVER ?? DEFAULTS.PEAKS_DRIVER;
  if (!VALID_PEAKS_DRIVERS.has(peaksDriver)) {
    errors.push('PEAKS_DRIVER must be one of: native, audiowaveform');
  }

  const publicBaseUrl = env.PUBLIC_BASE_URL ?? DEFAULTS.PUBLIC_BASE_URL;
  try {
    new URL(publicBaseUrl);
  } catch {
    errors.push('PUBLIC_BASE_URL must be a valid URL');
  }

  if (storageDriver === 's3') {
    for (const key of ['S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY']) {
      if (!env[key]) {
        errors.push(`${key} is required when STORAGE_DRIVER=s3`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed: ${errors.join('; ')}`);
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    PORT: port,
    CORS_ORIGIN: env.CORS_ORIGIN ?? DEFAULTS.CORS_ORIGIN,
    JWT_ACCESS_TTL: accessTtl,
    JWT_REFRESH_TTL: refreshTtl,
    STORAGE_DRIVER: storageDriver,
    LOCAL_STORAGE_DIR: env.LOCAL_STORAGE_DIR ?? DEFAULTS.LOCAL_STORAGE_DIR,
    PUBLIC_BASE_URL: publicBaseUrl,
    PEAKS_DRIVER: peaksDriver,
    MAX_UPLOAD_MB: maxUploadMb,
  };
}
