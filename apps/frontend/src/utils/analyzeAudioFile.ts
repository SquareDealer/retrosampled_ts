// Decodes an audio file in the browser to derive its duration and a compact
// waveform-peaks payload — matching the JSON shape the app already renders
// (see WaveformFromJsonForSample / WaveformBars). Doing this client-side keeps
// the backend free of audio-processing dependencies.

export type WaveformPeaks = {
  version: number;
  channels: number;
  sample_rate: number;
  samples_per_pixel: number;
  bits: number;
  length: number;
  data: number[];
};

export type AudioAnalysis = {
  durationSec: number;
  peaks: WaveformPeaks;
};

const DEFAULT_BUCKETS = 1000;

export async function analyzeAudioFile(
  file: File,
  buckets: number = DEFAULT_BUCKETS
): Promise<AudioAnalysis> {
  const arrayBuffer = await file.arrayBuffer();

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) {
    throw new Error("Web Audio API is not supported in this browser.");
  }

  const ctx = new AudioCtx();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const channel = audioBuffer.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(channel.length / buckets));

    const data: number[] = [];
    for (let i = 0; i < buckets; i++) {
      const start = i * blockSize;
      let max = 0;
      for (let j = 0; j < blockSize && start + j < channel.length; j++) {
        const value = Math.abs(channel[start + j]);
        if (value > max) max = value;
      }
      // Scale 0..1 magnitude to the int16 range used by the existing peaks JSON.
      data.push(Math.round(max * 32767));
    }

    return {
      durationSec: Math.round(audioBuffer.duration),
      peaks: {
        version: 2,
        channels: 1,
        sample_rate: audioBuffer.sampleRate,
        samples_per_pixel: blockSize,
        bits: 16,
        length: data.length,
        data,
      },
    };
  } finally {
    void ctx.close();
  }
}
