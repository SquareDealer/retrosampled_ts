/** DI token for the active {@link StoragePort} implementation. */
export const STORAGE = Symbol('STORAGE');

export type PutOptions = {
  contentType?: string;
};

/**
 * Object storage abstraction. Keys are POSIX-style relative paths
 * (`samples/{id}/audio.wav`, `samples/{id}/peaks.json`, `samples/{id}/cover.png`,
 * `avatars/{userId}.png`). Implementations: {@link LocalFsStorage} (dev/test)
 * and {@link S3Storage} (S3-compatible: AWS, MinIO, Supabase, R2).
 */
export interface StoragePort {
  put(key: string, body: Buffer, options?: PutOptions): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Stable URL the browser can load directly (audio, peaks, covers). */
  publicUrl(key: string): string;
  /** Time-limited URL for downloads; the local driver returns the public URL. */
  signedUrl(key: string, ttlSeconds: number): Promise<string>;
}

/**
 * Validates a storage key: no absolute paths, no `..` segments, no backslashes,
 * no empty segments. Returns the normalized key.
 */
export function assertSafeKey(key: string): string {
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error('Storage key must be a non-empty string');
  }

  if (key.includes('\\') || key.startsWith('/') || key.includes('\0')) {
    throw new Error(`Unsafe storage key: ${key}`);
  }

  const segments = key.split('/');
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') {
      throw new Error(`Unsafe storage key: ${key}`);
    }
  }

  return segments.join('/');
}

/** Encodes each path segment so keys with spaces still form valid URLs. */
export function encodeKeyForUrl(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

/** Best-effort MIME type by key extension (used when the caller passes none). */
export function contentTypeForKey(key: string): string {
  const extension = key.slice(key.lastIndexOf('.') + 1).toLowerCase();

  switch (extension) {
    case 'wav':
      return 'audio/wav';
    case 'mp3':
      return 'audio/mpeg';
    case 'flac':
      return 'audio/flac';
    case 'aif':
    case 'aiff':
      return 'audio/aiff';
    case 'json':
      return 'application/json';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}
