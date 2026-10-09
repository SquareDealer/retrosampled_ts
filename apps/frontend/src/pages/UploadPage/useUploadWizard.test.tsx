import React from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SampleDetail, SessionUser } from "@retrosampled/shared";
import { AuthContext, type AuthContextValue } from "../../auth/authContext";
import { useUploadWizard, validateMetadata } from "./useUploadWizard";

vi.mock("../../api/uploads", () => ({
  uploadSample: vi.fn(),
  uploadCover: vi.fn(),
  buildSampleFormData: vi.fn(() => new FormData()),
}));

vi.mock("../../api/samples", () => ({
  fetchSampleById: vi.fn(),
  updateSample: vi.fn(),
  setVisibility: vi.fn(),
  retryProcessing: vi.fn(),
  deleteSample: vi.fn(),
}));

import { uploadSample } from "../../api/uploads";
import { fetchSampleById, setVisibility, updateSample } from "../../api/samples";

const USER: SessionUser = {
  sub: "u1",
  id: "u1",
  email: "southkid@example.com",
  username: "southkid",
  displayName: null,
  avatarUrl: null,
  role: "USER",
};

const DRAFT: SampleDetail = {
  id: "draft-1",
  title: "drum break 94",
  authors: [{ id: "u1", name: "@southkid" }],
  creators: [],
  bpm: 0,
  musicalKey: "",
  tags: ["drums"],
  likesCount: 0,
  isLiked: false,
  audioPreviewUrl: "http://localhost/uploads/samples/draft-1/audio.wav",
  relatedSamples: { remakes: [] },
  ownerId: "u1",
  status: "DRAFT",
  duration: 7,
};

function Wrapper({ children }: { children: React.ReactNode }) {
  const value = {
    user: USER,
    status: "authenticated",
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    openAuthModal: vi.fn(),
    closeAuthModal: vi.fn(),
  } as unknown as AuthContextValue;

  return (
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={["/upload"]}>{children}</MemoryRouter>
    </AuthContext.Provider>
  );
}

const wavFile = () => new File([new Uint8Array(2048)], "drum_break_94.wav", { type: "audio/wav" });

describe("useUploadWizard", () => {
  beforeEach(() => {
    vi.mocked(uploadSample).mockReset();
    vi.mocked(updateSample).mockReset();
    vi.mocked(setVisibility).mockReset();
    vi.mocked(fetchSampleById).mockReset();
    vi.mocked(fetchSampleById).mockResolvedValue(DRAFT);
  });

  it("rejects unsupported files and accepts wav", () => {
    const { result } = renderHook(() => useUploadWizard(), { wrapper: Wrapper });

    act(() => {
      result.current.selectFile(new File(["x"], "bounce.m4a", { type: "audio/mp4" }));
    });
    expect(result.current.state.fileError).toMatch(/m4a isn't supported/);

    act(() => {
      result.current.selectFile(wavFile());
    });
    expect(result.current.state.fileError).toBeNull();
    expect(result.current.state.step).toBe(1);
  });

  it("preselects a flip take and its tempo over the parent's", () => {
    const take = wavFile();
    const { result } = renderHook(
      () => useUploadWizard({ parent: { ...DRAFT, bpm: 90 }, initialFile: take, initialBpm: 93.6 }),
      { wrapper: Wrapper }
    );

    expect(result.current.state.file).toBe(take);
    expect(result.current.state.fileError).toBeNull();
    expect(result.current.state.form.bpm).toBe("94");
    expect(result.current.state.step).toBe(1);
  });

  it("creates the draft on continue and moves to step 2; back returns to step 1", async () => {
    vi.mocked(uploadSample).mockResolvedValue(DRAFT);
    const { result } = renderHook(() => useUploadWizard(), { wrapper: Wrapper });

    act(() => {
      result.current.selectFile(wavFile());
    });
    await act(async () => {
      await result.current.continueFromDropzone();
    });

    expect(uploadSample).toHaveBeenCalledTimes(1);
    expect(result.current.state.step).toBe(2);
    expect(result.current.state.sample?.id).toBe("draft-1");
    expect(result.current.state.form.title).toBe("drum break 94");
    expect(result.current.state.form.tags).toEqual(["drums"]);

    act(() => {
      result.current.goTo(1);
    });
    expect(result.current.state.step).toBe(1);
  });

  it("does not advance from step 2 with missing metadata, then saves and reaches step 3", async () => {
    vi.mocked(uploadSample).mockResolvedValue(DRAFT);
    vi.mocked(updateSample).mockResolvedValue({ ...DRAFT, bpm: 94, musicalKey: "F#m" });
    const { result } = renderHook(() => useUploadWizard(), { wrapper: Wrapper });

    act(() => {
      result.current.selectFile(wavFile());
    });
    await act(async () => {
      await result.current.continueFromDropzone();
    });

    await act(async () => {
      await result.current.saveMetadata({ advance: true });
    });
    expect(updateSample).not.toHaveBeenCalled();
    expect(result.current.state.step).toBe(2);
    expect(result.current.state.formErrors.bpm).toBe("bpm is required");
    expect(result.current.state.formErrors.musicalKey).toBe("pick a key");

    act(() => {
      result.current.updateForm({ bpm: "94", musicalKey: "F#m" });
    });
    expect(result.current.state.formErrors).toEqual({});

    await act(async () => {
      await result.current.saveMetadata({ advance: true });
    });
    expect(updateSample).toHaveBeenCalledWith(
      "draft-1",
      expect.objectContaining({ title: "drum break 94", bpm: 94, musicalKey: "F#m", tags: ["drums"] })
    );
    expect(result.current.state.step).toBe(3);
  });

  it("remake mode prefills bpm, key and tags from the parent", () => {
    const parent: SampleDetail = { ...DRAFT, id: "parent", bpm: 120, musicalKey: "Dm", tags: ["retro", "synth"], status: "PUBLISHED" };
    const { result } = renderHook(() => useUploadWizard({ parent }), { wrapper: Wrapper });

    expect(result.current.state.form).toMatchObject({ bpm: "120", musicalKey: "Dm", tags: ["retro", "synth"] });
  });
});

describe("validateMetadata", () => {
  it("flags title, bpm range and key", () => {
    expect(
      validateMetadata({ title: " ", description: "", bpm: "999", musicalKey: "", sampleType: "", tags: [], collaborators: [] })
    ).toEqual({
      title: "title is required",
      bpm: "bpm must be a whole number between 20 and 400",
      musicalKey: "pick a key",
    });
  });
});
