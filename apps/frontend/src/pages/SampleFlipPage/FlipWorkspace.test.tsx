import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SampleDetail } from "@retrosampled/shared";
import { FlipWorkspace, type RemakeTakeState } from "./FlipWorkspace";
import type { FlipAudioEngine } from "./FlipAudioEngine";

vi.mock("./FlipAudioEngine", () => ({
  waveformPeaks: () => [0.1, 0.6, 1, 0.4],
}));
vi.mock("../../components/useAudioContextManager", () => ({
  useAudioContextManager: () => ({ acquireEditorSession: () => () => {} }),
}));
vi.mock("./flipWorkspaceStorage", () => ({
  writeWorkspace: vi.fn(async () => {}),
  readWorkspace: vi.fn(async () => ({
    metadata: {
      version: 1,
      bpm: 92,
      activeId: "take-1",
      takes: [{ id: "take-1", name: "Take 1", sourceBpm: 92 }],
    },
    audio: new Map([
      ["take-1", { sampleRate: 8000, channels: [new Float32Array(800)] }],
    ]),
  })),
}));

function fakeBuffer(channels: number, length: number, sampleRate: number) {
  const data = Array.from({ length: channels }, () => new Float32Array(length));
  return {
    numberOfChannels: channels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: (index: number) => data[index],
  };
}

function RemakeProbe() {
  const state = useLocation().state as RemakeTakeState;
  return (
    <p>
      remake {state.remakeFile.name} {state.remakeFile.type} {state.remakeBpm}
    </p>
  );
}

afterEach(cleanup);

describe("FlipWorkspace", () => {
  it("hands the active take to the remake wizard as a WAV file", async () => {
    const engine = {
      duration: 10,
      currentPosition: 0,
      buffer: fakeBuffer(1, 800, 8000),
      audioContext: { createBuffer: fakeBuffer },
      onChange: () => {},
      onError: () => {},
      play: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
      seek: vi.fn(),
      configure: vi.fn(),
      setBuffer: vi.fn(),
    };
    render(
      <MemoryRouter initialEntries={["/sample/sample/flip"]}>
        <Routes>
          <Route
            path="/sample/:sampleId/flip"
            element={
              <FlipWorkspace
                sample={{ id: "sample", title: "Test break", bpm: 120 } as SampleDetail}
                engine={engine as unknown as FlipAudioEngine}
                userId="user"
              />
            }
          />
          <Route path="/sample/:sampleId/remake" element={<RemakeProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText("Publish as remake"));
    expect(
      screen.getByText("remake test-break-take-1.wav audio/wav 92"),
    ).toBeTruthy();
  });
});
