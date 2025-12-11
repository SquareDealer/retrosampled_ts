import { useAudioContextManager } from "./AudioContextManager";
import "./MiniPlayer.css";

export const MiniPlayer: React.FC = () => {
  const { state, currentSample, togglePlay, seekTo } = useAudioContextManager();

  if (!currentSample) return null;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = x / rect.width;
    seekTo(progress);
  };

  return (
    <div className="mini-player">
      <div className="mini-player__title">
        {currentSample.title}
      </div>

      <div className="mini-player__progress" onClick={handleSeek}>
        <div
          className="mini-player__progress-fill"
          style={{ width: `${state.progress * 100}%` }}
        />
      </div>

      <button onClick={togglePlay}>
        {state.isPlaying ? "Pause" : "Play"}
      </button>
    </div>
  );
};

export default MiniPlayer;
