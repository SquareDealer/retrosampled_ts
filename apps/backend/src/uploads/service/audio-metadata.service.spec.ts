import { parseAudioMetadata } from './audio-metadata.service';
import { encodePcm16Wav } from './wav-reader';

describe('parseAudioMetadata', () => {
  it('reads duration, sample rate and channels from a WAV buffer', async () => {
    const sampleRate = 8000;
    const frames = 12000; // 1.5 s
    const mono = new Array(frames).fill(0).map((_, i) => Math.sin(i / 10) * 0.5);

    const metadata = await parseAudioMetadata(encodePcm16Wav([mono], sampleRate), 'audio/wav');

    expect(metadata.durationSec).toBeCloseTo(1.5, 3);
    expect(metadata.sampleRate).toBe(8000);
    expect(metadata.channels).toBe(1);
  });

  it('returns nulls for garbage input', async () => {
    const metadata = await parseAudioMetadata(Buffer.from('definitely not audio'), 'audio/mpeg');

    expect(metadata.durationSec).toBeNull();
  });
});
