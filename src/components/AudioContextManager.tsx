import React, {
  createContext,
  useRef,
  useState,
  PropsWithChildren,
  useCallback,
} from "react";
import WaveSurfer from "wavesurfer.js";

interface PlayerState {
  currentId: string | null;
  isPlaying: boolean;
  progress: number;
}

interface Sample {
  id: string | number;
  authorId: string | number;
  author?: string;
  title: string;
  tags: string[];
  audioUrl: string;
  time: string;
  key: string;
  bpm: string | number;
  type?: string;
  price: string | number;
}

interface AudioContextManager {
  state: PlayerState;
  currentSample: Sample | null;

  play: (sample: Sample, options?: any) => void;
  togglePlay: () => void;
  seekTo: (progress: number) => void;

  register(id: string, wavesurfer: WaveSurfer): void;
  unregister(id: string): void;
}

const AudioManagerContext = createContext<AudioContextManager | null>(null);

export const AudioManagerProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const players = useRef(new Map<string, WaveSurfer>());

  const [currentSample, setCurrentSample] = useState<Sample | null>(null);
  const [state, setState] = useState<PlayerState>({
    currentId: null,
    isPlaying: false,
    progress: 0,
  });

  const register = useCallback((id: string, ws: WaveSurfer) => {
    players.current.set(id.toString(), ws);
  }, []);

  const unregister = useCallback((id: string) => {
    players.current.delete(id.toString());
  }, []);

  const play = useCallback((sample: Sample) => {
    const id = sample.id.toString();
    const ws = players.current.get(id);
    if (!ws) return;

    // stop previous
    if (state.currentId && state.currentId !== id) {
      const prev = players.current.get(state.currentId);
      prev?.pause();
    }

    setCurrentSample(sample);
    setState(prev => ({
      ...prev,
      currentId: id,
      isPlaying: true,
      progress: 0
    }));

    ws.play();
  }, [state.currentId]);

  const togglePlay = useCallback(() => {
    const id = state.currentId;
    if (!id) return;

    const ws = players.current.get(id);
    if (!ws) return;

    if (state.isPlaying) {
      ws.pause();
      setState(prev => ({ ...prev, isPlaying: false }));
    } else {
      ws.play();
      setState(prev => ({ ...prev, isPlaying: true }));
    }
  }, [state]);

  const seekTo = useCallback((progress: number) => {
    if (!state.currentId) return;
    const ws = players.current.get(state.currentId);
    if (ws) ws.seekTo(progress);
  }, [state.currentId]);

  const value = {
    state,
    currentSample,
    play,
    togglePlay,
    seekTo,
    register,
    unregister
  };

  return (
    <AudioManagerContext.Provider value={value}>
      {children}
    </AudioManagerContext.Provider>
  );
};
