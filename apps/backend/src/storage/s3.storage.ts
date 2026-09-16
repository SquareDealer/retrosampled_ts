import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  PutOptions,
  StoragePort,
  assertSafeKey,
  contentTypeForKey,
  encodeKeyForUrl,
} from './storage.port';

export type S3StorageConfig = {
  bucket: string;
  region: string;
  /** Custom endpoint for MinIO / Supabase / R2; leave empty for AWS. */
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Path-style addressing (`endpoint/bucket/key`); default true when an endpoint is set. */
  forcePathStyle?: boolean;
  /** Public base URL for `publicUrl()` (CDN or public bucket); derived from the endpoint when omitted. */
  publicBaseUrl?: string;
};

/** Minimal surface of `S3Client` used here, so tests can pass a stub. */
export type S3ClientLike = Pick<S3Client, 'send'>;

/**
 * S3-compatible driver. `publicUrl` assumes the bucket (or a CDN in front of
 * it) is publicly readable; `signedUrl` presigns a GET for downloads.
 */
export class S3Storage implements StoragePort {
  private readonly client: S3ClientLike;
  private readonly forcePathStyle: boolean;

  constructor(
    private readonly config: S3StorageConfig,
    client?: S3ClientLike,
  ) {
    this.forcePathStyle = config.forcePathStyle ?? Boolean(config.endpoint);
    this.client =
      client ??
      new S3Client({
        region: config.region,
        endpoint: config.endpoint || undefined,
        forcePathStyle: this.forcePathStyle,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
  }

  async put(key: string, body: Buffer, options?: PutOptions): Promise<void> {
    const safeKey = assertSafeKey(key);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: safeKey,
        Body: body,
        ContentType: options?.contentType ?? contentTypeForKey(safeKey),
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: assertSafeKey(key) }),
    );

    const body = response.Body as
      | { transformToByteArray(): Promise<Uint8Array> }
      | undefined;

    if (!body) {
      throw new Error(`Object ${key} has no body`);
    }

    return Buffer.from(await body.transformToByteArray());
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: assertSafeKey(key) }),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: assertSafeKey(key) }),
      );
      return true;
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })
        .$metadata?.httpStatusCode;
      const name = (error as { name?: string }).name;

      if (status === 404 || name === 'NotFound' || name === 'NoSuchKey') {
        return false;
      }

      throw error;
    }
  }

  publicUrl(key: string): string {
    const encoded = encodeKeyForUrl(assertSafeKey(key));

    if (this.config.publicBaseUrl) {
      return `${this.config.publicBaseUrl.replace(/\/+$/, '')}/${encoded}`;
    }

    if (this.config.endpoint) {
      const endpoint = this.config.endpoint.replace(/\/+$/, '');
      return this.forcePathStyle
        ? `${endpoint}/${this.config.bucket}/${encoded}`
        : `${endpoint.replace('://', `://${this.config.bucket}.`)}/${encoded}`;
    }

    return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${encoded}`;
  }

  async signedUrl(key: string, ttlSeconds: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: assertSafeKey(key),
    });

    return getSignedUrl(this.client as S3Client, command, { expiresIn: ttlSeconds });
  }
}
