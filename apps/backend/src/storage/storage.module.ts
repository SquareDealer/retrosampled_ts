import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createStorageFromEnv } from './storage.factory';
import { STORAGE, StoragePort } from './storage.port';

/**
 * Global provider of the `STORAGE` token, chosen by `STORAGE_DRIVER`
 * (`local` | `s3`). Inject with `@Inject(STORAGE) private readonly storage: StoragePort`.
 */
@Global()
@Module({
  providers: [
    {
      provide: STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): StoragePort =>
        createStorageFromEnv({
          STORAGE_DRIVER: config.get<string>('STORAGE_DRIVER'),
          LOCAL_STORAGE_DIR: config.get<string>('LOCAL_STORAGE_DIR'),
          PUBLIC_BASE_URL: config.get<string>('PUBLIC_BASE_URL'),
          S3_ENDPOINT: config.get<string>('S3_ENDPOINT'),
          S3_REGION: config.get<string>('S3_REGION'),
          S3_BUCKET: config.get<string>('S3_BUCKET'),
          S3_ACCESS_KEY: config.get<string>('S3_ACCESS_KEY'),
          S3_SECRET_KEY: config.get<string>('S3_SECRET_KEY'),
          S3_FORCE_PATH_STYLE: config.get<string>('S3_FORCE_PATH_STYLE'),
          S3_PUBLIC_URL: config.get<string>('S3_PUBLIC_URL'),
        }),
    },
  ],
  exports: [STORAGE],
})
export class StorageModule {}
