import { createContext } from "react";
import type { Sample } from "@retrosampled/shared";

// ─────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────

export type PlayOptions = {
  startProgress?: number; // 0..1
  queue?: Sample[];
};

export interface PlayerState {
  currentId: string | null; // id текущего семпла (для удобства снаружи)
  isPlaying: boolean;
  progress: number; // 0..1
  isReady: boolean; // загружен ли текущий трек в плеер
  duration: number; // секунды; 0 до onload
  volume: number; // 0..1
}

export interface AudioContextManager {
  isEditorActive: boolean;
  acquireEditorSession: () => () => void;
  state: PlayerState;
  currentSample: Sample | null;

  // можно вызывать как play(sample), play(sample, startProgress) или play(sample, { startProgress, queue })
  play: (sample: Sample, options?: number | PlayOptions) => void;
  togglePlay: () => void;
  seekTo: (progress: number) => void;

  next: () => void;
  prev: () => void;
  hasNext: boolean;
  hasPrev: boolean;

  setVolume: (volume: number) => void;

  queue: Sample[];
}

// ─────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────

export const AudioManagerContext = createContext<AudioContextManager | null>(null);
