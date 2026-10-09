import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SampleDetail } from "@retrosampled/shared";
import SampleFlipPage, { FlipEditor } from "./SampleFlipPage";
import { FlipAudioEngine, type Playback } from "./FlipAudioEngine";
import { fetchSampleById } from "../../api/samples";
import { newProject, projectKey } from "./flipProject";

vi.mock("./FlipAudioEngine", () => ({
  waveformPeaks: () => [0.1, 0.6, 1, 0.4],
  FlipAudioEngine: { load: vi.fn() },
}));

const session = vi.hoisted(() => ({ acquire: vi.fn(() => vi.fn()) }));
vi.mock("../../components/useAudioContextManager", () => ({
  useAudioContextManager: () => ({ acquireEditorSession: session.acquire }),
}));
vi.mock("../../auth/useAuth", () => ({
  useAuth: () => ({ user: { id: "user" } }),
}));
vi.mock("../../api/samples", () => ({ fetchSampleById: vi.fn() }));

function makeEngine() {
  return {
    duration: 10,
    currentPosition: 0,
    buffer: {},
    onChange: (_state: Playback) => {},
    onError: (_message: string) => {},
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    configure: vi.fn(),
  };
}
const sample = { id: "sample", title: "Test break", bpm: 120 } as SampleDetail;
function mount(engine = makeEngine()) {
  const result = render(
    <MemoryRouter>
      <FlipEditor
        sample={sample}
        engine={engine as unknown as FlipAudioEngine}
        userId="user"
      />
    </MemoryRouter>,
  );
  return { ...result, engine };
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("FlipEditor", () => {
  it("places a numbered cue live without interrupting reverse playback, then retriggers that saved point", () => {
    const { engine } = mount();
    engine.currentPosition = 8;
    fireEvent.click(screen.getByText(/Add cue/));
    fireEvent.click(screen.getByLabelText("Reverse cue 1"));
    fireEvent.click(screen.getByLabelText("Play cue 1"));
    act(() => engine.onChange({ position: 6, playing: true }));
    engine.currentPosition = 5.75;
    engine.play.mockClear();
    engine.pause.mockClear();
    engine.configure.mockClear();

    fireEvent.keyDown(screen.getByLabelText("Waveform position"), {
      key: "7",
      code: "Digit7",
    });
    const stored = JSON.parse(
      localStorage.getItem(projectKey("user", "sample"))!,
    );
    expect(stored.cues.map((cue: { slot: number }) => cue.slot)).toEqual([
      1, 7,
    ]);
    expect(stored.cues[1].positionSeconds).toBe(5.75);
    expect(engine.play).not.toHaveBeenCalled();
    expect(engine.pause).not.toHaveBeenCalled();
    expect(engine.configure).not.toHaveBeenCalled();

    engine.currentPosition = 4;
    fireEvent.keyDown(window, { key: "7", repeat: true });
    expect(engine.play).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "7" });
    expect(engine.play).toHaveBeenCalledWith(5.75);
    expect(engine.configure).toHaveBeenCalledWith(1, 0, false);
  });

  it("does not place live cues when typing or using modified shortcuts", () => {
    mount();
    fireEvent.keyDown(screen.getByLabelText("Original BPM"), { key: "3" });
    fireEvent.keyDown(window, { key: "4", ctrlKey: true });
    fireEvent.keyDown(window, { key: "5", repeat: true });
    expect(
      JSON.parse(localStorage.getItem(projectKey("user", "sample"))!).cues,
    ).toEqual([]);
  });

  it("creates cues at the playhead, triggers from keyboard, and ignores text inputs, modifiers and repeat", () => {
    const { engine } = mount();
    engine.currentPosition = 2.5;
    fireEvent.click(screen.getByText(/Add cue/));
    fireEvent.keyDown(window, { key: "1", code: "Digit1" });
    expect(engine.play).toHaveBeenLastCalledWith(2.5);
    engine.play.mockClear();
    fireEvent.keyDown(screen.getByLabelText("Original BPM"), {
      key: "1",
      code: "Digit1",
    });
    fireEvent.keyDown(window, { key: "1", repeat: true });
    fireEvent.keyDown(window, { key: "1", metaKey: true });
    fireEvent.keyDown(window, { key: "2" });
    expect(engine.play).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Play cue 1"));
    expect(engine.play).toHaveBeenCalledWith(2.5);
  });

  it("limits slots, keeps other numbers stable, and reuses a deleted slot", () => {
    mount();
    for (let i = 0; i < 9; i++) fireEvent.click(screen.getByText(/Add cue/));
    expect(
      (screen.getByText(/Add cue/).closest("button") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByLabelText("Delete cue 3"));
    expect(
      (screen.getByLabelText("Play cue 3") as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByLabelText("Play cue 4") as HTMLButtonElement).disabled,
    ).toBe(false);
    fireEvent.click(screen.getByText(/Add cue/));
    expect(
      (screen.getByLabelText("Play cue 3") as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("combines reverse switches and restores settings after remount", () => {
    const { engine, unmount } = mount();
    engine.currentPosition = 4;
    fireEvent.click(screen.getByText(/Add cue/));
    fireEvent.click(screen.getByLabelText("Reverse cue 1"));
    fireEvent.click(screen.getByLabelText("Play cue 1"));
    expect(engine.configure).toHaveBeenLastCalledWith(1, 0, true);
    fireEvent.click(screen.getByText(/Reverse all/));
    expect(engine.configure).toHaveBeenLastCalledWith(1, 0, false);
    fireEvent.change(screen.getByLabelText("Pitch semitones"), {
      target: { value: "-7" },
    });
    unmount();
    const next = mount();
    expect(
      (screen.getByLabelText("Pitch semitones") as HTMLInputElement).value,
    ).toBe("-7");
    fireEvent.click(screen.getByLabelText("Play cue 1"));
    expect(next.engine.configure).toHaveBeenLastCalledWith(1, -7, false);
    expect(next.engine.play).toHaveBeenLastCalledWith(4);
  });

  it("moves markers with the keyboard and seeks from the accessible waveform control", () => {
    const { engine } = mount();
    fireEvent.click(screen.getByText(/Add cue/));
    fireEvent.keyDown(screen.getByRole("button", { name: /Cue 1 at/ }), {
      key: "ArrowRight",
    });
    fireEvent.click(screen.getByLabelText("Play cue 1"));
    expect(engine.play).toHaveBeenLastCalledWith(0.01);
    fireEvent.keyDown(screen.getByLabelText("Waveform position"), {
      key: "End",
    });
    expect(engine.seek).toHaveBeenLastCalledWith(10);
  });

  it("validates edits and keeps pitch independent of tempo", () => {
    localStorage.setItem(
      projectKey("user", "sample"),
      JSON.stringify({
        ...newProject("sample", 120),
        sourceBpm: 100,
        targetBpm: 100,
      }),
    );
    const { engine } = mount();
    const input = screen.getByLabelText("Target BPM");
    fireEvent.change(input, { target: { value: "150" } });
    fireEvent.blur(input);
    expect(engine.configure).toHaveBeenLastCalledWith(1.5, 0, false);
    fireEvent.change(screen.getByLabelText("Pitch semitones"), {
      target: { value: "-12" },
    });
    expect(engine.configure).toHaveBeenLastCalledWith(1.5, -12, false);
    fireEvent.change(input, { target: { value: "300" } });
    fireEvent.blur(input);
    expect((input as HTMLInputElement).value).toBe("300");
  });

  it("requires an original BPM before enabling tempo changes", () => {
    const engine = makeEngine();
    render(
      <MemoryRouter>
        <FlipEditor
          sample={{ ...sample, bpm: 0 }}
          engine={engine as unknown as FlipAudioEngine}
          userId="user"
        />
      </MemoryRouter>,
    );
    expect(
      (screen.getByLabelText("Target BPM") as HTMLInputElement).disabled,
    ).toBe(false);
    fireEvent.change(screen.getByLabelText("Original BPM"), {
      target: { value: "90" },
    });
    fireEvent.blur(screen.getByLabelText("Original BPM"));
    expect(
      (screen.getByLabelText("Target BPM") as HTMLInputElement).disabled,
    ).toBe(false);
    expect(
      (screen.getByLabelText("Target BPM") as HTMLInputElement).value,
    ).toBe("90");
  });

  it("shows audio/storage failures without crashing", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Quota");
    });
    const { engine } = mount();
    expect(screen.getByText("Local saving unavailable")).toBeTruthy();
    act(() => engine.onError("Audio processing failed."));
    expect(screen.getByText("Audio processing failed.")).toBeTruthy();
    expect(screen.getByText(/keep playing in this session/)).toBeTruthy();
  });
});

describe("SampleFlipPage loading", () => {
  const mountPage = () =>
    render(
      <MemoryRouter initialEntries={["/sample/sample/flip"]}>
        <Routes>
          <Route path="/sample/:sampleId/flip" element={<SampleFlipPage />} />
        </Routes>
      </MemoryRouter>,
    );

  it("shows an unavailable sample and releases the exclusive session on exit", async () => {
    vi.mocked(fetchSampleById).mockResolvedValueOnce(null);
    const { unmount } = mountPage();
    expect(screen.getByText("Loading sample…")).toBeTruthy();
    expect(
      await screen.findByText("Sample not found or unavailable."),
    ).toBeTruthy();
    const release = session.acquire.mock.results.at(-1)!.value;
    unmount();
    expect(release).toHaveBeenCalledOnce();
  });

  it("shows audio failures and retries loading without changing the sample", async () => {
    vi.mocked(fetchSampleById).mockResolvedValue({
      ...sample,
      audioPreviewUrl: "/sample.wav",
    });
    vi.mocked(FlipAudioEngine.load).mockRejectedValueOnce(
      new Error("Could not decode audio."),
    );
    vi.mocked(FlipAudioEngine.load).mockRejectedValueOnce(
      new Error("AudioWorklet unavailable."),
    );
    mountPage();
    expect(await screen.findByText("Could not decode audio.")).toBeTruthy();
    fireEvent.click(screen.getByText("Try again"));
    expect(await screen.findByText("AudioWorklet unavailable.")).toBeTruthy();
  });
});
