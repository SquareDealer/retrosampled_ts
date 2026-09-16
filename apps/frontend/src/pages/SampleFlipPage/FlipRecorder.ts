import recorderUrl from "./resample-recorder.worklet.js?url";

export const BEATS_PER_BAR = 4;
export const COUNT_IN_BARS = 4;
export type RecordingState = {
  phase: "idle" | "count-in" | "recording" | "finishing";
  bar: number;
  beat: number;
  elapsed: number;
};
export const IDLE_RECORDING: RecordingState = {
  phase: "idle",
  bar: 0,
  beat: 0,
  elapsed: 0,
};
type Chunk = { offset: number; channels: Float32Array[] };
const registrations = new WeakMap<AudioContext, Promise<void>>();

export function recordingStateAt(
  now: number,
  countInStart: number,
  bpm: number,
): RecordingState {
  const beats = Math.max(0, ((now - countInStart) * bpm) / 60);
  const countIn = beats < COUNT_IN_BARS * BEATS_PER_BAR;
  const position = countIn ? beats : beats - COUNT_IN_BARS * BEATS_PER_BAR;
  const beatIndex = Math.floor(position + 1e-9);
  return {
    phase: countIn ? "count-in" : "recording",
    bar: Math.floor(beatIndex / BEATS_PER_BAR) + 1,
    beat: (beatIndex % BEATS_PER_BAR) + 1,
    elapsed: countIn ? 0 : (position * 60) / bpm,
  };
}

export class FlipRecorder {
  onState: (state: RecordingState) => void = () => {};
  onError: (message: string) => void = () => {};
  private node: AudioWorkletNode | null = null;
  private chunks: Chunk[] = [];
  private interval: ReturnType<typeof setInterval> | undefined;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private clicks = new Set<{ oscillator: OscillatorNode; gain: GainNode }>();
  private countInStart = 0;
  private startFrame = 0;
  private nextBeat = 0;
  private bpm = 120;
  private pending: {
    resolve: (buffer: AudioBuffer | null) => void;
    reject: (error: Error) => void;
  } | null = null;

  constructor(
    private context: AudioContext,
    private input: AudioNode,
  ) {}

  static async create(context: AudioContext, input: AudioNode) {
    let registration = registrations.get(context);
    if (!registration) {
      registration = context.audioWorklet
        .addModule(recorderUrl)
        .catch((error) => {
          registrations.delete(context);
          throw error;
        });
      registrations.set(context, registration);
    }
    await registration;
    return new FlipRecorder(context, input);
  }

  start(bpm: number) {
    if (this.node) throw new Error("Recording is already running.");
    if (!Number.isFinite(bpm) || bpm <= 0)
      throw new Error("Enter a valid project BPM.");
    this.bpm = bpm;
    this.chunks = [];
    this.nextBeat = 0;
    this.countInStart = this.context.currentTime + 0.1;
    this.startFrame = Math.round(
      (this.countInStart + (COUNT_IN_BARS * BEATS_PER_BAR * 60) / bpm) *
        this.context.sampleRate,
    );
    const node = new AudioWorkletNode(this.context, "flip-resample-recorder", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      channelCount: 2,
      channelCountMode: "explicit",
      processorOptions: { startFrame: this.startFrame },
    });
    this.node = node;
    node.port.onmessage = ({ data }) => {
      if (this.node !== node) return;
      if (data.type === "chunk") this.chunks.push(data as Chunk);
      if (data.type === "done" && this.pending) {
        const pending = this.pending;
        this.pending = null;
        try {
          const frames = Math.max(0, data.frames as number);
          const buffer = frames
            ? this.context.createBuffer(2, frames, this.context.sampleRate)
            : null;
          if (buffer)
            for (const chunk of this.chunks) {
              const remaining = frames - chunk.offset;
              if (remaining <= 0) continue;
              for (let channel = 0; channel < 2; channel++) {
                buffer
                  .getChannelData(channel)
                  .set(
                    chunk.channels[channel].subarray(0, remaining),
                    chunk.offset,
                  );
              }
            }
          this.release();
          this.onState(IDLE_RECORDING);
          pending.resolve(buffer);
        } catch (error) {
          this.release();
          this.onState(IDLE_RECORDING);
          pending.reject(
            error instanceof Error
              ? error
              : new Error("Could not finish the recording."),
          );
        }
      }
    };
    node.onprocessorerror = () =>
      this.fail("Recording failed. Please try again.");
    this.input.connect(node);
    node.connect(this.context.destination);
    this.tick();
    this.interval = setInterval(this.tick, 25);
  }

  private tick = () => {
    const now = this.context.currentTime;
    const secondsPerBeat = 60 / this.bpm;
    // Audio-clock scheduling prevents UI rendering from shifting the clicks.
    while (this.countInStart + this.nextBeat * secondsPerBeat < now + 0.12) {
      const when = this.countInStart + this.nextBeat * secondsPerBeat;
      if (when >= now) this.click(when, this.nextBeat % BEATS_PER_BAR === 0);
      this.nextBeat++;
    }
    this.onState(recordingStateAt(now, this.countInStart, this.bpm));
  };

  private click(when: number, accent: boolean) {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.frequency.value = accent ? 1400 : 950;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.18 : 0.11, when + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.035);
    oscillator.connect(gain);
    // Monitor only: clicks never enter the recorded sample bus.
    gain.connect(this.context.destination);
    const click = { oscillator, gain };
    this.clicks.add(click);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      this.clicks.delete(click);
    };
    oscillator.start(when);
    oscillator.stop(when + 0.04);
  }

  stop(): Promise<AudioBuffer | null> {
    if (!this.node) return Promise.resolve(null);
    const stopFrame = Math.round(
      this.context.currentTime * this.context.sampleRate,
    );
    if (stopFrame <= this.startFrame) {
      this.cancel();
      return Promise.resolve(null);
    }
    if (this.pending)
      return Promise.reject(new Error("Recording is already finishing."));
    this.stopClock();
    this.onState({ ...IDLE_RECORDING, phase: "finishing" });
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
      this.node!.port.postMessage({ type: "stop", stopFrame });
      this.timeout = setTimeout(
        () => this.fail("Could not finish the recording. Please try again."),
        5000,
      );
    });
  }

  private stopClock() {
    clearInterval(this.interval);
    for (const { oscillator, gain } of this.clicks) {
      oscillator.onended = null;
      oscillator.stop();
      oscillator.disconnect();
      gain.disconnect();
    }
    this.clicks.clear();
  }

  private release() {
    this.stopClock();
    clearTimeout(this.timeout);
    if (this.node) {
      this.input.disconnect(this.node);
      this.node.port.postMessage({ type: "cancel" });
      this.node.disconnect();
      this.node.port.close();
      this.node = null;
    }
    this.chunks = [];
  }

  private fail(message: string) {
    const pending = this.pending;
    this.pending = null;
    this.release();
    this.onState(IDLE_RECORDING);
    if (pending) pending.reject(new Error(message));
    else this.onError(message);
  }

  cancel() {
    this.release();
    this.pending?.resolve(null);
    this.pending = null;
    this.onState(IDLE_RECORDING);
  }
}
