import React, { useRef } from "react";
import { Link } from "react-router-dom";
import { useAudioContextManager } from "./AudioContextManager";
import {
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
  VolumeIcon,
  VolumeMutedIcon,
} from "./icons";
import { formatTime } from "../utils/formatTime";
import "./MiniPlayer.css";

const SEEK_STEP = 0.04;
const MAX_TAGS = 3;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const MiniPlayer: React.FC = () => {
  const {
    state,
    currentSample,
    togglePlay,
    seekTo,
    next,
    prev,
    hasNext,
    hasPrev,
    setVolume,
  } = useAudioContextManager();
  const lastVolumeRef = useRef(1);

  if (!currentSample) return null;

  const { progress, duration, isPlaying, isReady, volume } = state;
  const hasDuration = duration > 0;
  const currentTime = hasDuration ? formatTime(progress * duration) : "0:00";
  const totalTime = hasDuration ? formatTime(duration) : "0:00";
  const isMuted = volume === 0;
  const tags = currentSample.tags.slice(0, MAX_TAGS);
  const keyValue = currentSample.key;
  const bpmValue = currentSample.bpm;
  const coverLetter = currentSample.title.trim().charAt(0) || "?";

  const handleSeekClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    seekTo(clamp01((event.clientX - rect.left) / rect.width));
  };

  const handleSeekKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      togglePlay();
      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? SEEK_STEP : -SEEK_STEP;
      seekTo(clamp01(progress + delta));
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      seekTo(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      seekTo(1);
    }
  };

  const handleMuteToggle = () => {
    if (isMuted) {
      setVolume(lastVolumeRef.current > 0 ? lastVolumeRef.current : 1);
      return;
    }
    lastVolumeRef.current = volume;
    setVolume(0);
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextVolume = Number(event.target.value);
    if (nextVolume > 0) lastVolumeRef.current = nextVolume;
    setVolume(nextVolume);
  };

  const progressPercent = Math.round(progress * 100);
  const volumePercent = Math.round(volume * 100);

  return (
    <div className="mini-player" role="region" aria-label="Now playing">
      <div
        className="mini-player__seek"
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
        aria-valuetext={`${currentTime} of ${totalTime}`}
        onClick={handleSeekClick}
        onKeyDown={handleSeekKeyDown}
      >
        <div className="mini-player__seek-fill" style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="mini-player__left">
        <div className="mini-player__cover" aria-hidden="true">
          {currentSample.coverUrl ? (
            <img className="mini-player__cover-image" src={currentSample.coverUrl} alt="" />
          ) : (
            <span className="mini-player__cover-placeholder">{coverLetter}</span>
          )}
        </div>

        <div className="mini-player__info">
          <Link to={`/sample/${currentSample.id}`} className="mini-player__title">
            {currentSample.title}
          </Link>
          {tags.length > 0 && (
            <div className="mini-player__tags">
              {tags.map((tag, index) => (
                <span className="tag" key={`${tag}-${index}`}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {(keyValue || bpmValue) && (
          <div className="mini-player__meta">
            {keyValue && (
              <div className="mini-player__meta-item">
                <span className="mini-player__meta-value">{keyValue}</span>
                <span className="mini-player__meta-label">key</span>
              </div>
            )}
            {bpmValue && (
              <div className="mini-player__meta-item">
                <span className="mini-player__meta-value">{bpmValue}</span>
                <span className="mini-player__meta-label">bpm</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mini-player__center">
        <button
          className="mini-player__button"
          type="button"
          aria-label="Previous"
          disabled={!hasPrev}
          onClick={prev}
        >
          <SkipBackIcon size={18} />
        </button>
        <button
          className="mini-player__button mini-player__button--play"
          type="button"
          aria-label={isPlaying ? "Pause" : "Play"}
          disabled={!isReady}
          onClick={togglePlay}
        >
          {isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
        </button>
        <button
          className="mini-player__button"
          type="button"
          aria-label="Next"
          disabled={!hasNext}
          onClick={next}
        >
          <SkipForwardIcon size={18} />
        </button>
      </div>

      <div className="mini-player__right">
        <span className="mini-player__time">
          <span className="mini-player__time-current">{currentTime}</span>
          <span className="mini-player__time-separator" aria-hidden="true">
            /
          </span>
          <span className="mini-player__time-total">{totalTime}</span>
        </span>

        <button
          className="mini-player__mute"
          type="button"
          aria-label={isMuted ? "Unmute" : "Mute"}
          aria-pressed={isMuted}
          onClick={handleMuteToggle}
        >
          {isMuted ? <VolumeMutedIcon size={18} /> : <VolumeIcon size={18} />}
        </button>

        <input
          className="mini-player__volume"
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={volume}
          aria-label="Volume"
          aria-valuetext={`${volumePercent}%`}
          style={{
            background: `linear-gradient(to right, var(--text-primary) ${volumePercent}%, var(--border-strong) ${volumePercent}%)`,
          }}
          onChange={handleVolumeChange}
        />
      </div>
    </div>
  );
};

export default MiniPlayer;
