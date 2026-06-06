import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

/**
 * Object storage abstraction.
 *
 * - `local` driver (default): writes to a directory served statically by the
 *   API at `/uploads`. Zero external dependencies — used in dev, CI and tests.
 * - `s3` driver: any S3-compatible bucket (AWS S3, Cloudflare R2, MinIO). Used
 *   in production. Configured entirely via STORAGE_* environment variables.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: 's3' | 'local';
  private readonly publicBaseUrl: string;
  private readonly localDir: string;
  private readonly bucket: string;
  private readonly s3?: S3Client;

  constructor(private readonly config: ConfigService) {
    this.driver =
      (this.config.get<string>('STORAGE_DRIVER') as 's3' | 'local') || 'local';
    this.bucket = this.config.get<string>('STORAGE_BUCKET') ?? 'retrosamples';
    this.localDir =
      this.config.get<string>('STORAGE_LOCAL_DIR') ?? join(process.cwd(), 'uploads');

    const port = this.config.get<string | number>('PORT') ?? 3000;
    this.publicBaseUrl = (
      this.config.get<string>('STORAGE_PUBLIC_URL') ??
      `http://localhost:${port}`
    ).replace(/\/$/, '');

    if (this.driver === 's3') {
      this.s3 = new S3Client({
        region: this.config.get<string>('STORAGE_REGION') ?? 'auto',
        endpoint: this.config.get<string>('STORAGE_ENDPOINT'),
        forcePathStyle: true,
        credentials: {
          accessKeyId: this.config.get<string>('STORAGE_ACCESS_KEY') ?? '',
          secretAccessKey: this.config.get<string>('STORAGE_SECRET_KEY') ?? '',
        },
      });
    }
  }

  /** Returns the directory backing the `local` driver (for static serving). */
  get localDirectory(): string {
    return this.localDir;
  }

  get isLocal(): boolean {
    return this.driver === 'local';
  }

  /** Stores an object and returns its public URL. */
  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    if (this.driver === 's3') {
      await this.s3!.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
      return `${this.publicBaseUrl}/${key}`;
    }

    const filePath = join(this.localDir, key);
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, body);
    return `${this.publicBaseUrl}/uploads/${key}`;
  }

  /** Best-effort delete. Never throws — used to clean up after failed writes. */
  async remove(key: string): Promise<void> {
    try {
      if (this.driver === 's3') {
        await this.s3!.send(
          new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
        );
      } else {
        await fs.rm(join(this.localDir, key), { force: true });
      }
    } catch (error) {
      this.logger.warn(`Failed to delete object ${key}: ${error}`);
    }
  }
}
