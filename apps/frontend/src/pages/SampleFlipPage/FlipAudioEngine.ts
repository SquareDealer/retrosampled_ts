import type { SoundTouchNode } from "@soundtouchjs/audio-worklet";
import processorUrl from "@soundtouchjs/audio-worklet/processor?url";
import { bufferOffset, clamp } from "./flipProject";

export type Playback = { position: number; playing: boolean };
type Voice = {
  source: AudioBufferSourceNode;
  silence: ConstantSourceNode;
  processor: SoundTouchNode;
  gain: GainNode;
};

/** One source at a time; each trigger gets a fresh DSP queue to avoid old audio leaking into the new cue. */
export class FlipAudioEngine {
  private readonly output: GainNode;
  private voice: Voice | null = null;
  private retired = new Map<Voice, ReturnType<typeof setTimeout>>();
  private frame = 0;
  private request = 0;
  private disposed = false;
  private position = 0;
  private anchorTime = 0;
  private anchorPosition = 0;
  private rate = 1;
  private pitch = 0;
  private reverse = false;
  private playing = false;
  private reversed: AudioBuffer | null = null;
  private endTimer: ReturnType<typeof setTimeout> | undefined;
  onChange: (state: Playback) => void = () => {};
  onError: (message: string) => void = () => {};

  constructor(
    private context: AudioContext,
    private sourceBuffer: AudioBuffer,
    private Processor: typeof SoundTouchNode,
  ) {
    this.output = context.createGain();
    this.output.connect(context.destination);
  }

  get audioContext() {
    return this.context;
  }
  get outputNode() {
    return this.output;
  }
  get buffer() {
    return this.sourceBuffer;
  }

  setBuffer(buffer: AudioBuffer) {
    this.stop(false);
    // Switching sources must leave no old voice in the resampling bus.
    for (const [voice, timer] of this.retired) {
      clearTimeout(timer);
      this.disconnect(voice);
    }
    this.retired.clear();
    this.sourceBuffer = buffer;
    this.reversed = null;
    this.rate = 1;
    this.pitch = 0;
  }

  static async load(
    url: string,
    signal: AbortSignal,
  ): Promise<FlipAudioEngine> {
    if (typeof AudioContext === "undefined")
      throw new Error("Web Audio is not supported in this browser.");
    const context = new AudioContext();
    try {
      if (!context.audioWorklet)
        throw new Error(
          "AudioWorklet is unavailable. Open this page over HTTPS in a supported browser.",
        );
      const { SoundTouchNode } = await import("@soundtouchjs/audio-worklet");
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error("Could not load the sample audio.");
      const buffer = await context.decodeAudioData(
        await response.arrayBuffer(),
      );
      await SoundTouchNode.register(context, processorUrl);
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      if (!buffer.length || !buffer.duration)
        throw new Error("This audio file is empty.");
      return new FlipAudioEngine(context, buffer, SoundTouchNode);
    } catch (error) {
      await context.close();
      throw error;
    }
  }

  get duration() {
    return this.buffer.duration;
  }
  get currentPosition() {
    return this.playing
      ? clamp(
          this.anchorPosition +
            (this.context.currentTime - this.anchorTime) *
              this.rate *
              (this.reverse ? -1 : 1),
          0,
          this.duration,
        )
      : this.position;
  }

  private emit = () =>
    this.onChange({ position: this.currentPosition, playing: this.playing });
  private tick = () => {
    this.emit();
    if (this.playing) this.frame = requestAnimationFrame(this.tick);
  };

  private disconnect(voice: Voice) {
    voice.source.onended = null;
    voice.source.stop();
    voice.silence.stop();
    voice.source.disconnect();
    voice.silence.disconnect();
    voice.processor.disconnect();
    voice.processor.port.close();
    voice.gain.disconnect();
  }

  private silence() {
    cancelAnimationFrame(this.frame);
    clearTimeout(this.endTimer);
    const voice = this.voice;
    this.voice = null;
    if (!voice) return;
    voice.source.onended = null;
    const now = this.context.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + 0.005);
    this.retired.set(
      voice,
      setTimeout(() => {
        this.disconnect(voice);
        this.retired.delete(voice);
      }, 10),
    );
  }

  private reverseBuffer() {
    if (!this.reversed) {
      this.reversed = this.context.createBuffer(
        this.buffer.numberOfChannels,
        this.buffer.length,
        this.buffer.sampleRate,
      );
      for (let channel = 0; channel < this.buffer.numberOfChannels; channel++) {
        this.reversed
          .getChannelData(channel)
          .set(this.buffer.getChannelData(channel));
        this.reversed.getChannelData(channel).reverse();
      }
    }
    return this.reversed;
  }

  async play(position = this.currentPosition) {
    if (this.disposed) return;
    const request = ++this.request;
    this.position = clamp(position, 0, this.duration);
    this.playing = false;
    this.silence();
    try {
      await this.context.resume();
      if (this.disposed || request !== this.request) return;
      const offset = bufferOffset(this.position, this.duration, this.reverse);
      if (offset >= this.duration) {
        this.emit();
        return;
      }
      const source = this.context.createBufferSource();
      source.buffer = this.reverse ? this.reverseBuffer() : this.buffer;
      source.playbackRate.value = this.rate;
      const processor = new this.Processor({
        context: this.context,
        outputChannelCount: this.buffer.numberOfChannels === 1 ? 1 : 2,
      });
      // Short windows keep cue triggering responsive (the library's automatic windows can exceed 130 ms).
      processor.setStretchParameters({
        sequenceMs: 40,
        seekWindowMs: 15,
        overlapMs: 8,
      });
      processor.playbackRate.value = this.rate;
      processor.pitchSemitones.value = this.pitch;
      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0, this.context.currentTime);
      gain.gain.linearRampToValueAtTime(1, this.context.currentTime + 0.005);
      source.connect(processor);
      // The processor needs input blocks to drain its final buffered audio after the source ends.
      const silence = this.context.createConstantSource();
      silence.offset.value = 0;
      silence.connect(processor);
      silence.start();
      processor.connect(gain);
      gain.connect(this.output);
      this.voice = { source, silence, processor, gain };
      processor.onprocessorerror = () => {
        if (this.voice?.processor !== processor) return;
        this.pause();
        this.onError("Audio processing failed. Try playing the sample again.");
      };
      this.anchorPosition = this.position;
      this.anchorTime = this.context.currentTime;
      this.playing = true;
      source.onended = () => {
        if (this.voice?.source !== source) return;
        // Let the stretch processor flush its final window before disconnecting.
        this.endTimer = setTimeout(() => {
          if (this.voice?.source !== source) return;
          this.position = this.reverse ? 0 : this.duration;
          this.playing = false;
          this.silence();
          this.emit();
        }, 350);
      };
      source.start(0, offset);
      this.tick();
    } catch (error) {
      if (this.disposed || request !== this.request) return;
      this.playing = false;
      this.silence();
      this.emit();
      this.onError(
        error instanceof Error ? error.message : "Could not start playback.",
      );
    }
  }

  pause() {
    ++this.request;
    this.position = this.currentPosition;
    this.playing = false;
    this.silence();
    this.emit();
  }

  seek(position: number) {
    if (this.playing) {
      void this.play(position);
      return;
    }
    ++this.request;
    this.position = clamp(position, 0, this.duration);
    this.emit();
  }

  stop(reverse: boolean) {
    this.pause();
    this.reverse = reverse;
    this.position = reverse ? this.duration : 0;
    this.emit();
  }

  configure(rate: number, pitch: number, reverse: boolean) {
    const position = this.currentPosition;
    const changedDirection = reverse !== this.reverse;
    this.anchorPosition = this.position = position;
    this.anchorTime = this.context.currentTime;
    this.rate = rate;
    this.pitch = pitch;
    this.reverse = reverse;
    if (changedDirection && this.playing) {
      void this.play(position);
      return;
    }
    if (this.voice) {
      this.voice.source.playbackRate.setValueAtTime(
        rate,
        this.context.currentTime,
      );
      this.voice.processor.playbackRate.setValueAtTime(
        rate,
        this.context.currentTime,
      );
      this.voice.processor.pitchSemitones.setValueAtTime(
        pitch,
        this.context.currentTime,
      );
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    ++this.request;
    cancelAnimationFrame(this.frame);
    clearTimeout(this.endTimer);
    if (this.voice) this.disconnect(this.voice);
    for (const [voice, timer] of this.retired) {
      clearTimeout(timer);
      this.disconnect(voice);
    }
    this.retired.clear();
    this.voice = null;
    this.playing = false;
    this.reversed = null;
    this.onChange = () => {};
    this.onError = () => {};
    this.output.disconnect();
    void this.context.close();
  }
}

export function waveformPeaks(buffer: AudioBuffer, count = 2000): number[] {
  const peaks = new Array<number>(Math.min(count, buffer.length)).fill(0);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < peaks.length; index++) {
      const start = Math.floor((index * data.length) / peaks.length);
      const end = Math.floor(((index + 1) * data.length) / peaks.length);
      for (let frame = start; frame < end; frame++)
        peaks[index] = Math.max(peaks[index], Math.abs(data[frame]));
    }
  }
  return peaks;
}
