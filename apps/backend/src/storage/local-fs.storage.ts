import { promises as fs } from 'fs';
import { dirname, resolve, sep } from 'path';
import { StoragePort, assertSafeKey, encodeKeyForUrl } from './storage.port';

/**
 * Stores objects under `rootDir` and serves them through the static
 * `/uploads/` mount that `main.ts` registers. Deliberately decorator-free so
 * `prisma/seed.ts` can use it without booting Nest.
 */
export class LocalFsStorage implements StoragePort {
  private readonly root: string;

  constructor(
    rootDir: string,
    private readonly publicBaseUrl: string,
  ) {
    this.root = resolve(rootDir);
  }

  get rootDir(): string {
    return this.root;
  }

  /** Resolves a key inside the root and refuses anything escaping it. */
  private pathFor(key: string): string {
    const safeKey = assertSafeKey(key);
    const absolute = resolve(this.root, ...safeKey.split('/'));

    if (absolute !== this.root && !absolute.startsWith(this.root + sep)) {
      throw new Error(`Unsafe storage key: ${key}`);
    }

    return absolute;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const target = this.pathFor(key);
    await fs.mkdir(dirname(target), { recursive: true });
    await fs.writeFile(target, body);
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.pathFor(key));
  }

  async delete(key: string): Promise<void> {
    const target = this.pathFor(key);
    await fs.rm(target, { force: true });

    // Prune the per-sample directory once its last object is gone.
    const parent = dirname(target);
    if (parent !== this.root && parent.startsWith(this.root + sep)) {
      await fs.rmdir(parent).catch(() => undefined);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const stats = await fs.stat(this.pathFor(key));
      return stats.isFile();
    } catch {
      return false;
    }
  }

  publicUrl(key: string): string {
    const base = this.publicBaseUrl.replace(/\/+$/, '');
    return `${base}/uploads/${encodeKeyForUrl(assertSafeKey(key))}`;
  }

  async signedUrl(key: string): Promise<string> {
    return this.publicUrl(key);
  }
}
