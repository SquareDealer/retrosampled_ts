import React, {
  createContext,
  useRef,
  useState,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
} from "react";
import WaveSurfer from "wavesurfer.js";
import { Sample } from "../types/Sample";

// ─────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────

export interface PlayerState {
  currentId: string | null; // id текущего семпла (для удобства снаружи)
  isPlaying: boolean;
  progress: number; // 0..1
  isReady: boolean; // загружен ли текущий трек в плеер
}

export interface AudioContextManager {
  state: PlayerState;
  currentSample: Sample | null;

  // можно вызывать как play(sample) или play(sample, startProgress)
  play: (sample: Sample, startProgress?: number) => void;
  togglePlay: () => void;
  seekTo: (progress: number) => void;
}

// ─────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────

const AudioManagerContext = createContext<AudioContextManager | null>(null);

// ─────────────────────────────────────────────────────────────
// Provider Component (один глобальный WaveSurfer внутри)
// ─────────────────────────────────────────────────────────────

export const AudioManagerProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const wsRef = useRef<WaveSurfer | null>(null);

  const currentIdRef = useRef<string | null>(null);
  const isReadyRef = useRef<boolean>(false);

  // сюда будем класть прогресс, с которого хотим стартовать новый семпл
  const pendingStartProgressRef = useRef<number | null>(null);

  const [currentSample, setCurrentSample] = useState<Sample | null>(null);
  const [state, setState] = useState<PlayerState>({
    currentId: null,
    isPlaying: false,
    progress: 0,
    isReady: false,
  });

  // ─────────────────────────────────────────────────────────────
  // Инициализация глобального WaveSurfer
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const container = document.createElement("div");

    const ws = WaveSurfer.create({
      container,
      height: 0,
      interact: false,
      cursorWidth: 0,
      normalize: true,
    });

    wsRef.current = ws;

    ws.on("ready", () => {
      isReadyRef.current = true;

      let startP = pendingStartProgressRef.current ?? 0;
      startP = Math.max(0, Math.min(1, startP));

      if (startP > 0) {
        ws.seekTo(startP);
      }

      setState((prev) => ({
        ...prev,
        isReady: true,
        progress: startP,
      }));

      ws.play();
      setState((prev) => ({
        ...prev,
        isPlaying: true,
      }));

      pendingStartProgressRef.current = null;
    });

    ws.on("audioprocess", () => {
      if (!isReadyRef.current || !currentIdRef.current) return;

      const duration = ws.getDuration() || 1;
      const time = ws.getCurrentTime();
      const progress = time / duration;

      setState((prev) => ({
        ...prev,
        progress,
      }));
    });

    ws.on("finish", () => {
      setState((prev) => ({
        ...prev,
        isPlaying: false,
        progress: 0,
      }));
    });

    return () => {
      ws.destroy();
      wsRef.current = null;
      currentIdRef.current = null;
      isReadyRef.current = false;
      pendingStartProgressRef.current = null;
    };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Playback Control Methods
  // ─────────────────────────────────────────────────────────────

  const play = useCallback(
  (sample: Sample, startProgress?: number) => {
    const ws = wsRef.current;
    if (!ws) return;

    const newId = sample.id.toString();
    const clampedStart =
      startProgress != null
        ? Math.max(0, Math.min(1, startProgress))
        : undefined;

    // Если кликаем по тому же семплу — просто play/pause
    if (currentIdRef.current && currentIdRef.current === newId && currentSample) {
      if (!isReadyRef.current) return;

      ws.playPause();
      const nowPlaying = ws.isPlaying();
      setState((prev) => ({
        ...prev,
        isPlaying: nowPlaying,
      }));
      return;
    }

    // 👇 НОВЫЙ СЕМПЛ

    currentIdRef.current = newId;
    isReadyRef.current = false;
    pendingStartProgressRef.current =
      clampedStart != null ? clampedStart : 0;

    ws.stop();
    ws.seekTo(0);

    setCurrentSample(sample);
    setState({
      currentId: newId,
      isPlaying: true,
      // 🔥 ключевая строка — до ready сразу показываем нужный прогресс
      progress: clampedStart != null ? clampedStart : 0,
      isReady: false,
    });

    ws.load(sample.audioUrl);
  },
  [currentSample]
);

  const togglePlay = useCallback(() => {
    const ws = wsRef.current;
    if (!ws) return;

    if (!isReadyRef.current) return;

    ws.playPause();
    const nowPlaying = ws.isPlaying();
    setState((prev) => ({
      ...prev,
      isPlaying: nowPlaying,
    }));
  }, []);

  const seekTo = useCallback((progress: number) => {
  const ws = wsRef.current;
  if (!ws) return;

  // если трек ещё не готов, лучше игнорировать навигацию
  if (!isReadyRef.current) return;

  const clamped = Math.max(0, Math.min(1, progress));

  // был ли трек в данный момент в состоянии "играет"
  const wasPlaying = ws.isPlaying();

  // перемотка
  ws.seekTo(clamped);

  // если раньше стоял на паузе — запускаем воспроизведение с новой позиции
  if (!wasPlaying) {
    ws.play();
  }

  setState((prev) => ({
    ...prev,
    progress: clamped,
    isPlaying: true, // после навигации всегда играем
    }));
  }, []);

  const value: AudioContextManager = {
    state,
    currentSample,
    play,
    togglePlay,
    seekTo,
  };

  return (
    <AudioManagerContext.Provider value={value}>
      {children}
    </AudioManagerContext.Provider>
  );
};

// ─────────────────────────────────────────────────────────────
// Hook to Access AudioManager
// ─────────────────────────────────────────────────────────────

export const useAudioContextManager = (): AudioContextManager => {
  const context = useContext(AudioManagerContext);
  if (!context) {
    throw new Error("useAudioContextManager must be used within AudioManagerProvider");
  }
  return context;
};
