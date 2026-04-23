import React, {
  createContext,
  useRef,
  useState,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
} from "react";
import { Howl } from "howler";
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
// Provider Component (один глобальный Howl внутри)
// ─────────────────────────────────────────────────────────────

export const AudioManagerProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const howlRef = useRef<Howl | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const currentIdRef = useRef<string | null>(null);
  const playbackSessionRef = useRef(0);

  const [currentSample, setCurrentSample] = useState<Sample | null>(null);
  const [state, setState] = useState<PlayerState>({
    currentId: null,
    isPlaying: false,
    progress: 0,
    isReady: false,
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
    (sample: Sample, startProgress?: number) => {
      const newId = sample.id.toString();
      const clampedStart =
        startProgress != null
          ? Math.max(0, Math.min(1, startProgress))
          : 0;

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
      
      setState({
        currentId: newId,
        isPlaying: false,
        progress: clampedStart,
        isReady: false,
      });

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

          setState((prev) => ({
            ...prev,
            isReady: true,
          }));

          // Перематываем на нужную позицию
          const duration = howl.duration();
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
              progress: Math.max(0, Math.min(1, seek / duration)),
            }));
          }

          if (howl.playing()) {
            startProgressLoop();
          }
        },
        onend: () => {
          if (!isSessionActive(howl)) return;

          stopProgressLoop();
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

      const clamped = Math.max(0, Math.min(1, progress));
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
