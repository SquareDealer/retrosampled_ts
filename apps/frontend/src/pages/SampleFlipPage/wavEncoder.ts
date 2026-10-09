type PcmSource = Pick<
  AudioBuffer,
  "numberOfChannels" | "sampleRate" | "length" | "getChannelData"
>;

/** Encodes an audio buffer as an interleaved 16-bit PCM WAV file. */
export function encodeWav(buffer: PcmSource): Blob {
  return new Blob([encodeWavBytes(buffer)], { type: "audio/wav" });
}

export function encodeWavBytes(buffer: PcmSource): ArrayBuffer {
  const channels = buffer.numberOfChannels;
  const blockAlign = channels * 2;
  const dataSize = buffer.length * blockAlign;
  const view = new DataView(new ArrayBuffer(44 + dataSize));
  const writeTag = (offset: number, tag: string) => {
    for (let i = 0; i < tag.length; i++)
      view.setUint8(offset + i, tag.charCodeAt(i));
  };

  writeTag(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeTag(8, "WAVE");
  writeTag(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeTag(36, "data");
  view.setUint32(40, dataSize, true);

  const data = Array.from({ length: channels }, (_, channel) =>
    buffer.getChannelData(channel),
  );
  let offset = 44;
  for (let frame = 0; frame < buffer.length; frame++) {
    for (const channel of data) {
      const sample = Math.max(-1, Math.min(1, channel[frame]));
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true,
      );
      offset += 2;
    }
  }
  return view.buffer;
}

/** A filesystem-safe `.wav` name for a take. */
export function wavFileName(...parts: string[]): string {
  const base = parts
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "take"}.wav`;
}
