import React, {
  createContext,
  useRef,
  useState,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
} from "react";
import { Howl, Howler } from "howler";
import { Sample } from "../types/Sample";

// Автоматически переходить к следующему семплу очереди по окончании трека
const AUTO_ADVANCE = true;

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

const AudioManagerContext = createContext<AudioContextManager | null>(null);

const sameId = (a: Sample["id"], b: Sample["id"] | null) => b !== null && String(a) === String(b);

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

// Правило выбора очереди при play(): явная → текущая (если содержит семпл) → [sample]
const resolveQueue = (sample: Sample, current: Sample[], requested?: Sample[]): Sample[] => {
  if (requested) return requested;
  if (current.some((item) => sameId(item.id, sample.id))) return current;
  return [sample];
};

const findNeighbor = (list: Sample[], currentId: string | null, direction: 1 | -1): Sample | null => {
  if (!currentId) return null;
  const index = list.findIndex((item) => sameId(item.id, currentId));
  if (index === -1) return null;
  return list[index + direction] ?? null;
};

// ─────────────────────────────────────────────────────────────
// Provider Component (один глобальный Howl внутри)
// ─────────────────────────────────────────────────────────────

export const AudioManagerProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const howlRef = useRef<Howl | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const currentIdRef = useRef<string | null>(null);
  const playbackSessionRef = useRef(0);
  const queueRef = useRef<Sample[]>([]);
  // Ссылка на актуальный play, чтобы колбэки Howl не держали устаревшее замыкание
  const playRef = useRef<AudioContextManager["play"]>(() => {});

  const [currentSample, setCurrentSample] = useState<Sample | null>(null);
  const [queue, setQueue] = useState<Sample[]>([]);
  const [state, setState] = useState<PlayerState>({
    currentId: null,
    isPlaying: false,
    progress: 0,
    isReady: false,
    duration: 0,
    volume: 1,
  });

  // ─────────────────────────────────────────────────────────────
  // Progress Update Loop
  // ─────────────────────────────────────────────────────────────

  const updateProgress = useCallback(() => {
    const howl = howlRef.current;
    if (!howl || !currentIdRef.current) return;

    const seek = howl.seek() as number;
    const duration = howl.duration();

    if (duration > 0) {
      const progress = seek / duration;
      setState((prev) => ({
        ...prev,
        progress: Math.min(1, progress),
      }));
    }

    // Продолжаем loop пока howl существует и currentId установлен
    // (не проверяем howl.playing() т.к. это может дать false сразу после play())
    if (howlRef.current && currentIdRef.current) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  const startProgressLoop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    updateProgress();
  }, [updateProgress]);

  const stopProgressLoop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Cleanup on Unmount
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopProgressLoop();
      playbackSessionRef.current += 1;
      if (howlRef.current) {
        howlRef.current.off();
        howlRef.current.unload();
        howlRef.current = null;
      }
      currentIdRef.current = null;
    };
  }, [stopProgressLoop]);

  // ─────────────────────────────────────────────────────────────
  // Playback Control Methods
  // ─────────────────────────────────────────────────────────────

  const play = useCallback(
    (sample: Sample, options?: number | PlayOptions) => {
      const opts: PlayOptions =
        typeof options === "number" ? { startProgress: options } : options ?? {};
      const newId = sample.id.toString();
      const clampedStart = opts.startProgress != null ? clamp01(opts.startProgress) : 0;

      const nextQueue = resolveQueue(sample, queueRef.current, opts.queue);
      if (nextQueue !== queueRef.current) {
        queueRef.current = nextQueue;
        setQueue(nextQueue);
      }

      // Если кликаем по тому же семплу — просто play/pause
      if (currentIdRef.current === newId && howlRef.current) {
        const howl = howlRef.current;

        if (howl.playing()) {
          howl.pause();
          setState((prev) => ({
            ...prev,
            isPlaying: false,
          }));
        } else {
          howl.play();
          startProgressLoop();
          setState((prev) => ({
            ...prev,
            isPlaying: true,
          }));
        }
        return;
      }

      // 👇 НОВЫЙ СЕМПЛ
      const sessionId = playbackSessionRef.current + 1;
      playbackSessionRef.current = sessionId;

      // Останавливаем и выгружаем старый
      if (howlRef.current) {
        stopProgressLoop();
        howlRef.current.off();
        howlRef.current.unload();
        howlRef.current = null;
      }

      currentIdRef.current = newId;
      setCurrentSample(sample);

      setState((prev) => ({
        currentId: newId,
        isPlaying: false,
        progress: clampedStart,
        isReady: false,
        duration: 0,
        volume: prev.volume,
      }));

      const isSessionActive = (activeHowl: Howl) => {
        const activeHowlRef = howlRef.current;
        return (
          playbackSessionRef.current === sessionId &&
          (activeHowlRef === null || activeHowlRef === activeHowl) &&
          currentIdRef.current === newId
        );
      };

      // Создаем новый Howl
      const howl = new Howl({
        src: [sample.audioUrl],
        html5: true,
        onload: () => {
          if (!isSessionActive(howl)) return;

          const duration = howl.duration();

          setState((prev) => ({
            ...prev,
            isReady: true,
            duration: Number.isFinite(duration) ? duration : 0,
          }));

          // Перематываем на нужную позицию
          if (duration > 0 && clampedStart > 0) {
            howl.seek(clampedStart * duration);
          }

          // Запускаем воспроизведение
          howl.play();
        },
        onplay: () => {
          if (!isSessionActive(howl)) return;
          startProgressLoop();
          setState((prev) => ({
            ...prev,
            isPlaying: true,
          }));
        },
        onpause: () => {
          if (!isSessionActive(howl)) return;
          stopProgressLoop();
          setState((prev) => ({
            ...prev,
            isPlaying: false,
          }));
        },
        onseek: () => {
          if (!isSessionActive(howl)) return;

          const seek = howl.seek() as number;
          const duration = howl.duration();

          if (duration > 0 && Number.isFinite(seek)) {
            setState((prev) => ({
              ...prev,
              progress: clamp01(seek / duration),
            }));
          }

          if (howl.playing()) {
            startProgressLoop();
          }
        },
        onend: () => {
          if (!isSessionActive(howl)) return;

          stopProgressLoop();

          const upcoming = AUTO_ADVANCE
            ? findNeighbor(queueRef.current, currentIdRef.current, 1)
            : null;
          if (upcoming) {
            playRef.current(upcoming, { queue: queueRef.current });
            return;
          }

          setState((prev) => ({
            ...prev,
            isPlaying: false,
            progress: 0,
          }));
        },
        onloaderror: (_, err) => {
          if (!isSessionActive(howl)) return;

          console.error("Ошибка загрузки аудио:", err);
          stopProgressLoop();
          setState((prev) => ({
            ...prev,
            isPlaying: false,
            isReady: false,
          }));
        },
        onplayerror: (_, err) => {
          if (!isSessionActive(howl)) return;

          console.error("Ошибка воспроизведения:", err);
          stopProgressLoop();
          setState((prev) => ({
            ...prev,
            isPlaying: false,
          }));
        },
      });

      howlRef.current = howl;
    },
    [startProgressLoop, stopProgressLoop]
  );

  playRef.current = play;

  const togglePlay = useCallback(() => {
    const howl = howlRef.current;
    if (!howl || !state.isReady) return;

    if (howl.playing()) {
      howl.pause();
      stopProgressLoop();
      setState((prev) => ({
        ...prev,
        isPlaying: false,
      }));
    } else {
      howl.play();
      startProgressLoop();
      setState((prev) => ({
        ...prev,
        isPlaying: true,
      }));
    }
  }, [state.isReady, startProgressLoop, stopProgressLoop]);

  const seekTo = useCallback(
    (progress: number) => {
      const howl = howlRef.current;
      if (!howl || !state.isReady) return;

      const clamped = clamp01(progress);
      const duration = howl.duration();

      if (duration > 0) {
        const seekTime = clamped * duration;
        howl.seek(seekTime);

        setState((prev) => ({
          ...prev,
          progress: clamped,
        }));

        // Если был на паузе — запускаем воспроизведение
        if (!howl.playing()) {
          howl.play();
          startProgressLoop();
          setState((prev) => ({
            ...prev,
            isPlaying: true,
          }));
        }
      }
    },
    [state.isReady, startProgressLoop]
  );

  const next = useCallback(() => {
    const upcoming = findNeighbor(queueRef.current, currentIdRef.current, 1);
    if (upcoming) play(upcoming, { queue: queueRef.current });
  }, [play]);

  const prev = useCallback(() => {
    const previous = findNeighbor(queueRef.current, currentIdRef.current, -1);
    if (previous) play(previous, { queue: queueRef.current });
  }, [play]);

  const setVolume = useCallback((volume: number) => {
    const clamped = clamp01(Number.isFinite(volume) ? volume : 1);
    // Глобальная громкость Howler сохраняется для всех последующих Howl
    Howler.volume(clamped);
    setState((prev) => ({
      ...prev,
      volume: clamped,
    }));
  }, []);

  const currentIndex = state.currentId
    ? queue.findIndex((item) => sameId(item.id, state.currentId))
    : -1;
  const hasNext = currentIndex !== -1 && currentIndex < queue.length - 1;
  const hasPrev = currentIndex > 0;

  const value: AudioContextManager = {
    state,
    currentSample,
    play,
    togglePlay,
    seekTo,
    next,
    prev,
    hasNext,
    hasPrev,
    setVolume,
    queue,
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
