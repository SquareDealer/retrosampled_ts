import { Injectable } from '@nestjs/common';
import * as mm from 'music-metadata';
import { parseWavHeader } from './wav-reader';

export type AudioMetadata = {
  durationSec: number | null;
  sampleRate: number | null;
  channels: number | null;
  bitsPerSample: number | null;
  /** Container/codec reported by the parser, e.g. `WAVE`, `MPEG`, `FLAC`. */
  container: string | null;
};

/**
 * Pure helper so the seed script and tests can call it without Nest.
 * Uses `music-metadata` v7 (CJS) and falls back to the native RIFF header for
 * WAV files the parser cannot read.
 */
export async function parseAudioMetadata(
  buffer: Buffer,
  mimeType: string,
): Promise<AudioMetadata> {
  let result: AudioMetadata = {
    durationSec: null,
    sampleRate: null,
    channels: null,
    bitsPerSample: null,
    container: null,
  };

  try {
    const parsed = await mm.parseBuffer(buffer, { mimeType }, { duration: true });
    const format = parsed.format;

    result = {
      durationSec: typeof format.duration === 'number' ? format.duration : null,
      sampleRate: format.sampleRate ?? null,
      channels: format.numberOfChannels ?? null,
      bitsPerSample: format.bitsPerSample ?? null,
      container: format.container ?? null,
    };
  } catch {
    // fall through to the RIFF header for WAV
  }

  if (result.durationSec === null) {
    const wav = parseWavHeader(buffer);

    if (wav) {
      result = {
        durationSec: wav.frames / wav.sampleRate,
        sampleRate: wav.sampleRate,
        channels: wav.channels,
        bitsPerSample: wav.bitsPerSample,
        container: result.container ?? 'WAVE',
      };
    }
  }

  return result;
}

@Injectable()
export class AudioMetadataService {
  parse(buffer: Buffer, mimeType: string): Promise<AudioMetadata> {
    return parseAudioMetadata(buffer, mimeType);
  }
}
