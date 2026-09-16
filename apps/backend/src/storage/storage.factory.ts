import { LocalFsStorage } from './local-fs.storage';
import { S3Storage } from './s3.storage';
import { StoragePort } from './storage.port';

export type StorageEnv = {
  STORAGE_DRIVER?: string;
  LOCAL_STORAGE_DIR?: string;
  PUBLIC_BASE_URL?: string;
  S3_ENDPOINT?: string;
  S3_REGION?: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY?: string;
  S3_SECRET_KEY?: string;
  S3_FORCE_PATH_STYLE?: string;
  S3_PUBLIC_URL?: string;
};

/**
 * Builds the storage driver from environment-shaped config. Shared by the Nest
 * `StorageModule` factory and by `prisma/seed.ts`, which runs outside Nest.
 */
export function createStorageFromEnv(env: StorageEnv): StoragePort {
  const driver = env.STORAGE_DRIVER ?? 'local';

  if (driver === 's3') {
    return new S3Storage({
      bucket: env.S3_BUCKET ?? '',
      region: env.S3_REGION ?? 'us-east-1',
      endpoint: env.S3_ENDPOINT || undefined,
      accessKeyId: env.S3_ACCESS_KEY ?? '',
      secretAccessKey: env.S3_SECRET_KEY ?? '',
      forcePathStyle:
        env.S3_FORCE_PATH_STYLE === undefined || env.S3_FORCE_PATH_STYLE === ''
          ? undefined
          : env.S3_FORCE_PATH_STYLE === 'true',
      publicBaseUrl: env.S3_PUBLIC_URL || undefined,
    });
  }

  return new LocalFsStorage(
    env.LOCAL_STORAGE_DIR ?? './uploads',
    env.PUBLIC_BASE_URL ?? 'http://localhost:3000',
  );
}
