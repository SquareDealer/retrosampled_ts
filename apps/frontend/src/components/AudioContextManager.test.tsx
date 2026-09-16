import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Sample } from "@retrosampled/shared";
import { Howl } from "howler";
import {
  AudioManagerProvider,
  useAudioContextManager,
} from "./AudioContextManager";

vi.mock("howler", () => ({
  Howl: vi.fn(() => ({ off: vi.fn(), unload: vi.fn(), play: vi.fn() })),
  Howler: { volume: vi.fn() },
}));
afterEach(cleanup);

describe("exclusive editor playback", () => {
  it("unloads the player, blocks late callbacks and new plays until all editor sessions release", () => {
    const { result } = renderHook(() => useAudioContextManager(), {
      wrapper: AudioManagerProvider,
    });
    const sample = { id: "1", audioUrl: "/test.wav" } as Sample;
    act(() => result.current.play(sample));
    const howl = vi.mocked(Howl).mock.results[0].value;
    const options = vi.mocked(Howl).mock.calls[0][0];
    let release!: () => void, releaseSecond!: () => void;
    act(() => {
      release = result.current.acquireEditorSession();
      releaseSecond = result.current.acquireEditorSession();
    });
    expect(howl.unload).toHaveBeenCalledOnce();
    expect(result.current.isEditorActive).toBe(true);
    expect(result.current.currentSample).toBeNull();
    act(() => {
      options.onload?.call(howl, 1);
      result.current.play(sample);
      result.current.togglePlay();
      result.current.seekTo(0.5);
      release();
    });
    expect(result.current.isEditorActive).toBe(true);
    expect(howl.play).not.toHaveBeenCalled();
    expect(Howl).toHaveBeenCalledOnce();
    act(() => releaseSecond());
    expect(result.current.isEditorActive).toBe(false);
    expect(result.current.state.isPlaying).toBe(false);
    act(() => result.current.play(sample));
    expect(Howl).toHaveBeenCalledTimes(2);
  });
});
