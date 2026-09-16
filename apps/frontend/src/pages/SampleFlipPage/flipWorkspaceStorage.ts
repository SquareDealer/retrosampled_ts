export type TakeMetadata = { id: string; name: string; sourceBpm: number };
export type WorkspaceMetadata = {
  version: 1;
  bpm: number;
  activeId: string;
  takes: TakeMetadata[];
};
export type StoredAudio = { sampleRate: number; channels: Float32Array[] };

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Local audio storage is unavailable."));
      return;
    }
    const request = indexedDB.open("retrosampled-flips", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("workspaces");
      request.result.createObjectStore("takes");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Local audio storage is blocked by another tab."));
  });
}

function read<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readWorkspace(
  key: string,
): Promise<{
  metadata: WorkspaceMetadata;
  audio: Map<string, StoredAudio>;
} | null> {
  const db = await openDatabase();
  try {
    const metadata = await read<WorkspaceMetadata | undefined>(
      db.transaction("workspaces").objectStore("workspaces").get(key),
    );
    if (!metadata) return null;
    if (
      metadata.version !== 1 ||
      !Number.isFinite(metadata.bpm) ||
      metadata.bpm <= 0 ||
      !Array.isArray(metadata.takes)
    )
      throw new Error("Saved workspace is invalid.");
    const audio = new Map<string, StoredAudio>();
    await Promise.all(
      metadata.takes.map(async (take) => {
        const stored = await read<StoredAudio | undefined>(
          db.transaction("takes").objectStore("takes").get([key, take.id]),
        );
        if (
          !stored ||
          !Number.isFinite(stored.sampleRate) ||
          stored.sampleRate <= 0 ||
          !stored.channels.length ||
          !stored.channels.every(
            (channel) =>
              channel instanceof Float32Array &&
              channel.length > 0 &&
              channel.length === stored.channels[0].length,
          )
        ) {
          throw new Error("A saved take could not be restored.");
        }
        audio.set(take.id, stored);
      }),
    );
    return { metadata, audio };
  } finally {
    db.close();
  }
}

/** Audio and metadata are committed together; already saved PCM is never rewritten for BPM/selection changes. */
export async function writeWorkspace(
  key: string,
  metadata: WorkspaceMetadata,
  newAudio: Array<{ id: string; buffer: AudioBuffer }>,
): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(["workspaces", "takes"], "readwrite");
    const complete = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () =>
        reject(
          transaction.error ?? new Error("Could not save this workspace."),
        );
      transaction.onerror = () => reject(transaction.error);
    });
    try {
      for (const take of newAudio) {
        const channels = Array.from(
          { length: take.buffer.numberOfChannels },
          (_, channel) => take.buffer.getChannelData(channel),
        );
        transaction
          .objectStore("takes")
          .put(
            {
              sampleRate: take.buffer.sampleRate,
              channels,
            } satisfies StoredAudio,
            [key, take.id],
          );
      }
      transaction.objectStore("workspaces").put(metadata, key);
    } catch (error) {
      transaction.abort();
      await complete.catch(() => {});
      throw error;
    }
    await complete;
  } finally {
    db.close();
  }
}
