import { resolve } from 'path';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Local storage driver: serve `LOCAL_STORAGE_DIR` at `/uploads/` so audio,
 * peaks, covers and avatars are reachable at `StoragePort.publicUrl(key)`.
 * Call after `enableCors()` so the Vite origin may fetch these files.
 * No-op for the S3 driver (objects are served by the bucket / CDN).
 */
export function serveLocalUploads(app: NestExpressApplication, config: ConfigService): void {
  if ((config.get<string>('STORAGE_DRIVER') ?? 'local') !== 'local') {
    return;
  }

  app.useStaticAssets(resolve(config.get<string>('LOCAL_STORAGE_DIR') ?? './uploads'), {
    prefix: '/uploads/',
    maxAge: '1h',
  });
}
