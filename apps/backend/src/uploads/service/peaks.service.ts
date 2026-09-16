import { execFile, execFileSync } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PeaksJson } from '@retrosampled/shared';
import { TARGET_PEAKS_LENGTH, computeWavPeaks } from './wav-reader';

const execFileAsync = promisify(execFile);

export type PeaksDriver = 'native' | 'audiowaveform';

export type PeaksInput = {
  buffer: Buffer;
  /** Canonical extension: wav | mp3 | flac | aiff. */
  extension: string;
  /** Known duration, used to pick `samples_per_pixel` for the external tool. */
  durationSec?: number | null;
  sampleRate?: number | null;
};

/** Returns the path of the `audiowaveform` binary on PATH, or null. */
export function findAudiowaveformBinary(): string | null {
  try {
    const output = execFileSync(process.platform === 'win32' ? 'where' : 'which', [
      'audiowaveform',
    ]);
    const first = output.toString().split(/\r?\n/).find((line) => line.trim().length > 0);
    return first ? first.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Produces the peaks JSON consumed by `WaveformFromJsonForSample`.
 *
 * - `native` (default): RIFF/PCM reader, WAV only; other formats → `null`.
 * - `audiowaveform`: shells out to the `audiowaveform` binary when it is on
 *   PATH (handles mp3/flac too), falling back to the native reader.
 */
@Injectable()
export class PeaksService {
  private readonly logger = new Logger(PeaksService.name);
  private readonly driver: PeaksDriver;
  private binaryPath: string | null | undefined;

  constructor(@Optional() config?: ConfigService) {
    const configured = config?.get<string>('PEAKS_DRIVER') ?? process.env.PEAKS_DRIVER;
    this.driver = configured === 'audiowaveform' ? 'audiowaveform' : 'native';
  }

  /** Native reader, exposed for tests and the seed. */
  computeNative(buffer: Buffer): PeaksJson | null {
    return computeWavPeaks(buffer);
  }

  async generate(input: PeaksInput): Promise<PeaksJson | null> {
    if (this.driver === 'audiowaveform') {
      const external = await this.generateWithAudiowaveform(input);
      if (external) {
        return external;
      }
    }

    if (input.extension === 'wav') {
      return computeWavPeaks(input.buffer);
    }

    return null;
  }

  private resolveBinary(): string | null {
    if (this.binaryPath === undefined) {
      this.binaryPath = findAudiowaveformBinary();
      if (!this.binaryPath) {
        this.logger.warn('PEAKS_DRIVER=audiowaveform but no binary on PATH; using the native reader');
      }
    }

    return this.binaryPath;
  }

  private async generateWithAudiowaveform(input: PeaksInput): Promise<PeaksJson | null> {
    const binary = this.resolveBinary();
    if (!binary) {
      return null;
    }

    const directory = await fs.mkdtemp(join(tmpdir(), 'retrosampled-peaks-'));
    const inputPath = join(directory, `input.${input.extension}`);
    const outputPath = join(directory, 'peaks.json');

    try {
      await fs.writeFile(inputPath, input.buffer);

      const args = ['-i', inputPath, '-o', outputPath, '-b', '8'];
      const frames =
        input.durationSec && input.sampleRate ? input.durationSec * input.sampleRate : null;

      if (frames) {
        args.push('-z', String(Math.max(1, Math.ceil(frames / TARGET_PEAKS_LENGTH))));
      } else {
        args.push('--pixels-per-second', '20');
      }

      await execFileAsync(binary, args, { timeout: 60_000 });
      const raw = await fs.readFile(outputPath, 'utf8');
      const parsed = JSON.parse(raw) as PeaksJson;

      if (!Array.isArray(parsed.data) || typeof parsed.length !== 'number') {
        return null;
      }

      return { ...parsed, version: 2 };
    } catch (error) {
      this.logger.warn(`audiowaveform failed: ${(error as Error).message}`);
      return null;
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  }
}
