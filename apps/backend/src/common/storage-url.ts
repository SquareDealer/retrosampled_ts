/**
 * Public URL for an object key under the local storage driver
 * (`./uploads/<key>` is served at `${PUBLIC_BASE_URL}/uploads/<key>`).
 *
 * Task 3.1a's `StoragePort.publicUrl()` does the same for the local driver; at
 * merge time this helper becomes a thin wrapper over it (or is replaced).
 * Absolute URLs pass through untouched so seeded/mock rows keep working.
 */
export function getPublicBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

export function publicUrlForKey(key: string | null | undefined): string | null {
  if (!key) {
    return null;
  }

  if (/^https?:\/\//i.test(key) || key.startsWith('/')) {
    return key;
  }

  return `${getPublicBaseUrl()}/uploads/${key.replace(/^\/+/, '')}`;
}
