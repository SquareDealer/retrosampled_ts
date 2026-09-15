import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, rm, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { publicUrlForKey } from '../common/storage-url';

/**
 * Minimal object store for avatars.
 *
 * Task 3.1a ships the real `StoragePort` (`STORAGE` token, local-fs + S3). It
 * is not in this tree, so this is a deliberately tiny local-FS stand-in with
 * the same two calls the users module needs. At merge time the provider
 * behind `AVATAR_STORAGE` becomes an adapter over `StoragePort`
 * (`put(key, buffer, {contentType})` / `delete(key)` / `publicUrl(key)`).
 */
export interface AvatarStorage {
  /** Stores the object and returns its public URL. */
  put(key: string, buffer: Buffer, mime: string): Promise<string>;
  delete(key: string): Promise<void>;
}

export const AVATAR_STORAGE = Symbol('AVATAR_STORAGE');

@Injectable()
export class LocalAvatarStorage implements AvatarStorage {
  private readonly root: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.root = resolve(config.get<string>('LOCAL_STORAGE_DIR') ?? './uploads');
  }

  private pathFor(key: string): string {
    const safe = key.replace(/\.\.+/g, '').replace(/^\/+/, '');
    return resolve(this.root, safe);
  }

  async put(key: string, buffer: Buffer, _mime: string): Promise<string> {
    void _mime;
    const target = this.pathFor(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, buffer);

    return publicUrlForKey(key) as string;
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}
