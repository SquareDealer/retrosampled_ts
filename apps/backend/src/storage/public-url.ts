import { StoragePort } from './storage.port';

/**
 * `StoragePort.publicUrl` for nullable keys. Absolute URLs and root-relative
 * paths pass through untouched so seeded / legacy rows keep working.
 */
export function publicUrlOrNull(
  storage: Pick<StoragePort, 'publicUrl'>,
  key: string | null | undefined,
): string | null {
  if (!key) {
    return null;
  }

  if (/^(https?:)?\/\//i.test(key) || key.startsWith('/')) {
    return key;
  }

  return storage.publicUrl(key);
}
