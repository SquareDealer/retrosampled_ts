import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SoundTouchNode } from "@soundtouchjs/audio-worklet";
import { FlipAudioEngine } from "./FlipAudioEngine";

function parameter(value = 0) {
  return {
    value,
    setValueAtTime: vi.fn(function (this: { value: number }, next: number) {
      this.value = next;
    }),
    cancelScheduledValues: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  };
}
class Processor {
  setStretchParameters = vi.fn();
  playbackRate = parameter(1);
  pitchSemitones = parameter();
  connect = vi.fn();
  disconnect = vi.fn();
  port = { close: vi.fn() };
}
function buffer(channels = 2, length = 10, sampleRate = 1) {
  const data = Array.from({ length: channels }, (_, channel) =>
    Float32Array.from({ length }, (_, index) => index + channel * 100),
  );
  return {
    duration: length / sampleRate,
    numberOfChannels: channels,
    length,
    sampleRate,
    getChannelData: (channel: number) => data[channel],
  } as AudioBuffer;
}
function setup() {
  const sources: Array<ReturnType<typeof source>> = [];
  const source = () => ({
    buffer: null as AudioBuffer | null,
    playbackRate: parameter(1),
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  });
  const context = {
    currentTime: 0,
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
    destination: {},
    createBuffer: buffer,
    createBufferSource: () => {
      const next = source();
      sources.push(next);
      return next;
    },
    createGain: () => ({
      gain: parameter(1),
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    createConstantSource: () => ({
      offset: parameter(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }),
  };
  const engine = new FlipAudioEngine(
    context as unknown as AudioContext,
    buffer(),
    Processor as unknown as typeof SoundTouchNode,
  );
  engine.onChange = vi.fn();
  engine.onError = vi.fn();
  return { engine, context, sources };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("FlipAudioEngine", () => {
  it("tracks source time across tempo changes and pause/resume independently of pitch", async () => {
    const { engine, context, sources } = setup();
    await engine.play(2);
    context.currentTime = 1;
    expect(engine.currentPosition).toBe(3);
    engine.configure(1.5, -12, false);
    expect(sources[0].playbackRate.value).toBe(1.5);
    context.currentTime = 3;
    expect(engine.currentPosition).toBe(6);
    engine.pause();
    context.currentTime = 5;
    expect(engine.currentPosition).toBe(6);
    await engine.play();
    expect(sources[1].start).toHaveBeenCalledWith(0, 6);
    engine.dispose();
  });

  it("reverses both channels without mutating the original and moves toward the start", async () => {
    const { engine, context, sources } = setup();
    engine.configure(1, 0, true);
    await engine.play(3);
    expect(sources[0].start).toHaveBeenCalledWith(0, 7);
    expect(Array.from(sources[0].buffer!.getChannelData(0))).toEqual([
      9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
    ]);
    expect(sources[0].buffer!.getChannelData(1)[0]).toBe(109);
    expect(engine.buffer.getChannelData(0)[0]).toBe(0);
    context.currentTime = 1;
    expect(engine.currentPosition).toBe(2);
    engine.dispose();
  });

  it("lets only the latest trigger resume and cancels pending playback on stop", async () => {
    const { engine, context, sources } = setup();
    const resolve: Array<() => void> = [];
    context.resume.mockImplementation(
      () => new Promise<void>((done) => resolve.push(done)),
    );
    const first = engine.play(1),
      second = engine.play(4);
    resolve[0]();
    await first;
    expect(sources).toHaveLength(0);
    resolve[1]();
    await second;
    expect(sources).toHaveLength(1);
    expect(sources[0].start).toHaveBeenCalledWith(0, 4);
    const third = engine.play(7);
    engine.stop(false);
    resolve[2]();
    await third;
    expect(sources).toHaveLength(1);
    expect(engine.currentPosition).toBe(0);
    engine.dispose();
  });

  it("retires old DSP voices and ignores stale end events after a new cue", async () => {
    const { engine, sources } = setup();
    await engine.play(1);
    const previousEnd = sources[0].onended!;
    await engine.play(4);
    previousEnd();
    vi.advanceTimersByTime(400);
    expect(sources[0].stop).toHaveBeenCalledOnce();
    expect(sources[1].stop).not.toHaveBeenCalled();
    expect(engine.onChange).toHaveBeenLastCalledWith({
      position: 4,
      playing: true,
    });
    engine.dispose();
  });

  it("changes direction from the current position and handles silent boundaries", async () => {
    const { engine, context, sources } = setup();
    await engine.play(2);
    context.currentTime = 1;
    engine.configure(1, 0, true);
    await Promise.resolve();
    expect(sources[1].start).toHaveBeenCalledWith(0, 7);
    await engine.play(0);
    expect(sources).toHaveLength(2);
    expect(engine.onChange).toHaveBeenLastCalledWith({
      position: 0,
      playing: false,
    });
    engine.stop(true);
    expect(engine.currentPosition).toBe(10);
    engine.dispose();
  });

  it("cleans up once on disposal and reports resume failures", async () => {
    const { engine, context, sources } = setup();
    context.resume.mockRejectedValueOnce(new Error("Audio unavailable"));
    await engine.play();
    expect(engine.onError).toHaveBeenCalledWith("Audio unavailable");
    await engine.play();
    engine.dispose();
    engine.dispose();
    expect(context.close).toHaveBeenCalledOnce();
    expect(sources[0].disconnect).toHaveBeenCalledOnce();
  });
});
