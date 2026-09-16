import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { LocalFsStorage } from './local-fs.storage';

describe('LocalFsStorage', () => {
  let root: string;
  let storage: LocalFsStorage;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'retrosampled-storage-'));
    storage = new LocalFsStorage(root, 'http://localhost:3000/');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('round-trips an object through put / exists / get / delete', async () => {
    const key = 'samples/abc/audio.wav';
    const body = Buffer.from('RIFF....WAVE');

    await expect(storage.exists(key)).resolves.toBe(false);

    await storage.put(key, body);

    await expect(storage.exists(key)).resolves.toBe(true);
    await expect(storage.get(key)).resolves.toEqual(body);

    await storage.delete(key);
    await expect(storage.exists(key)).resolves.toBe(false);
    // The now-empty samples/abc directory is pruned as well.
    expect(existsSync(join(root, 'samples', 'abc'))).toBe(false);
    expect(existsSync(join(root, 'samples'))).toBe(true);
  });

  it('deleting a missing object is a no-op', async () => {
    await expect(storage.delete('samples/missing/audio.wav')).resolves.toBeUndefined();
  });

  it('builds public URLs under /uploads/ and encodes segments', () => {
    expect(storage.publicUrl('samples/abc/audio.wav')).toBe(
      'http://localhost:3000/uploads/samples/abc/audio.wav',
    );
    expect(storage.publicUrl('samples/abc/my file.json')).toBe(
      'http://localhost:3000/uploads/samples/abc/my%20file.json',
    );
  });

  it('signed URLs are the public URL for the local driver', async () => {
    await expect(storage.signedUrl('samples/abc/audio.wav')).resolves.toBe(
      storage.publicUrl('samples/abc/audio.wav'),
    );
  });

  it.each(['../escape.txt', 'samples/../../etc/passwd', '/absolute.txt', 'a//b', 'a\\b'])(
    'rejects unsafe key %s',
    async (key) => {
      await expect(storage.put(key, Buffer.from('x'))).rejects.toThrow(/Unsafe storage key/);
      expect(() => storage.publicUrl(key)).toThrow(/Unsafe storage key/);
    },
  );
});
