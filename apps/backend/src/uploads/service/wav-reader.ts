import type { PeaksJson } from '@retrosampled/shared';

export type WavHeader = {
  /** 1 = PCM integer, 3 = IEEE float (resolved through WAVE_FORMAT_EXTENSIBLE). */
  formatCode: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  blockAlign: number;
  /** Byte offset of the first sample frame. */
  dataOffset: number;
  /** Byte length of the sample data actually present in the buffer. */
  dataLength: number;
  frames: number;
};

const WAVE_FORMAT_PCM = 1;
const WAVE_FORMAT_IEEE_FLOAT = 3;
const WAVE_FORMAT_EXTENSIBLE = 0xfffe;

/** Target number of peak columns (`length`) in the generated JSON. */
export const TARGET_PEAKS_LENGTH = 800;

/**
 * Parses a RIFF/WAVE header. Returns `null` for anything that is not a WAV
 * file we can decode (PCM 8/16/24/32-bit or 32-bit float).
 */
export function parseWavHeader(buffer: Buffer): WavHeader | null {
  if (buffer.length < 12) {
    return null;
  }

  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    return null;
  }

  let offset = 12;
  let format: Omit<WavHeader, 'dataOffset' | 'dataLength' | 'frames'> | null = null;
  let data: { offset: number; length: number } | null = null;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;

    if (chunkId === 'fmt ' && chunkSize >= 16 && chunkStart + 16 <= buffer.length) {
      let formatCode = buffer.readUInt16LE(chunkStart);
      const channels = buffer.readUInt16LE(chunkStart + 2);
      const sampleRate = buffer.readUInt32LE(chunkStart + 4);
      const blockAlign = buffer.readUInt16LE(chunkStart + 12);
      const bitsPerSample = buffer.readUInt16LE(chunkStart + 14);

      if (formatCode === WAVE_FORMAT_EXTENSIBLE && chunkSize >= 40 && chunkStart + 26 <= buffer.length) {
        // The real format is the first two bytes of the SubFormat GUID.
        formatCode = buffer.readUInt16LE(chunkStart + 24);
      }

      format = { formatCode, channels, sampleRate, bitsPerSample, blockAlign };
    } else if (chunkId === 'data') {
      const available = Math.max(0, Math.min(chunkSize, buffer.length - chunkStart));
      data = { offset: chunkStart, length: available };
      // `data` is normally the last chunk; stop scanning.
      break;
    }

    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  if (!format || !data) {
    return null;
  }

  const { formatCode, channels, sampleRate, bitsPerSample } = format;
  const blockAlign = format.blockAlign || (channels * bitsPerSample) / 8;

  const supported =
    (formatCode === WAVE_FORMAT_PCM && [8, 16, 24, 32].includes(bitsPerSample)) ||
    (formatCode === WAVE_FORMAT_IEEE_FLOAT && bitsPerSample === 32);

  if (!supported || channels < 1 || sampleRate < 1 || blockAlign < 1) {
    return null;
  }

  return {
    formatCode,
    channels,
    sampleRate,
    bitsPerSample,
    blockAlign,
    dataOffset: data.offset,
    dataLength: data.length,
    frames: Math.floor(data.length / blockAlign),
  };
}

function sampleReader(header: WavHeader, buffer: Buffer): (byteOffset: number) => number {
  if (header.formatCode === WAVE_FORMAT_IEEE_FLOAT) {
    return (at) => Math.max(-1, Math.min(1, buffer.readFloatLE(at)));
  }

  switch (header.bitsPerSample) {
    case 8:
      return (at) => (buffer.readUInt8(at) - 128) / 128;
    case 16:
      return (at) => buffer.readInt16LE(at) / 32768;
    case 24:
      return (at) => {
        const raw = buffer.readUIntLE(at, 3);
        return (raw >= 0x800000 ? raw - 0x1000000 : raw) / 8388608;
      };
    case 32:
    default:
      return (at) => buffer.readInt32LE(at) / 2147483648;
  }
}

/**
 * Computes audiowaveform-compatible min/max peaks (8-bit, mono mixdown of all
 * channels) for a PCM/float WAV buffer. `samples_per_pixel` is chosen so that
 * `length ≈ TARGET_PEAKS_LENGTH`.
 */
export function computeWavPeaks(
  buffer: Buffer,
  targetLength: number = TARGET_PEAKS_LENGTH,
): PeaksJson | null {
  const header = parseWavHeader(buffer);

  if (!header || header.frames === 0) {
    return null;
  }

  const samplesPerPixel = Math.max(1, Math.ceil(header.frames / targetLength));
  const length = Math.ceil(header.frames / samplesPerPixel);
  const bytesPerSample = header.bitsPerSample / 8;
  const read = sampleReader(header, buffer);
  const data: number[] = new Array(length * 2);

  for (let pixel = 0; pixel < length; pixel += 1) {
    const startFrame = pixel * samplesPerPixel;
    const endFrame = Math.min(header.frames, startFrame + samplesPerPixel);
    let min = 1;
    let max = -1;

    for (let frame = startFrame; frame < endFrame; frame += 1) {
      const frameOffset = header.dataOffset + frame * header.blockAlign;

      for (let channel = 0; channel < header.channels; channel += 1) {
        const value = read(frameOffset + channel * bytesPerSample);
        if (value < min) min = value;
        if (value > max) max = value;
      }
    }

    data[pixel * 2] = Math.max(-128, Math.min(127, Math.round(min * 127)));
    data[pixel * 2 + 1] = Math.max(-128, Math.min(127, Math.round(max * 127)));
  }

  return {
    version: 2,
    channels: 1,
    sample_rate: header.sampleRate,
    samples_per_pixel: samplesPerPixel,
    bits: 8,
    length,
    data,
  };
}

/**
 * Builds a 16-bit PCM WAV buffer from per-channel sample arrays in [-1, 1].
 * Used by tests and by nothing else in production.
 */
export function encodePcm16Wav(
  channels: number[][],
  sampleRate: number,
  bitsPerSample: 8 | 16 | 24 | 32 = 16,
): Buffer {
  const channelCount = channels.length;
  const frames = channels[0]?.length ?? 0;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channelCount * bytesPerSample;
  const dataLength = frames * blockAlign;
  const buffer = Buffer.alloc(44 + dataLength);

  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataLength, 40);

  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const value = Math.max(-1, Math.min(1, channels[channel][frame] ?? 0));

      switch (bitsPerSample) {
        case 8:
          buffer.writeUInt8(Math.round(value * 127) + 128, offset);
          break;
        case 16:
          buffer.writeInt16LE(Math.round(value * 32767), offset);
          break;
        case 24:
          buffer.writeIntLE(Math.round(value * 8388607), offset, 3);
          break;
        case 32:
          buffer.writeInt32LE(Math.round(value * 2147483647), offset);
          break;
      }

      offset += bytesPerSample;
    }
  }

  return buffer;
}
