import React from "react";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Sample } from "../../types/Sample";
import { useAudioContextManager } from "../AudioContextManager";
import { WaveformFromJsonForSample } from "../waveform/WaveformFromJsonForSample";
import { WaveformBars } from "../waveform/WaveformBars";

export type SamplePlayerProps = {
  sampleId: string;
  sampleTitle: string;
  audioUrl: string;
  waveformPeaksUrl?: string;
  waveformData?: number[];
  duration?: number;
  isPlayable?: boolean;
};

const formatTime = (totalSeconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const SamplePlayer: React.FC<SamplePlayerProps> = ({
  sampleId,
  sampleTitle,
  audioUrl,
  waveformPeaksUrl,
  waveformData,
  duration,
  isPlayable = true,
}) => {
  const { currentSample, state, play, seekTo, togglePlay } = useAudioContextManager();
  const [waveformWidth, setWaveformWidth] = useState(560);
  const waveformRef = useRef<HTMLDivElement | null>(null);

  const sampleForPlayer: Sample = useMemo(
    () => ({
      id: sampleId,
      authorId: "sample-page",
      author: "",
      title: sampleTitle,
      tags: [],
      audioUrl,
      time: duration ? formatTime(duration) : "0:00",
      key: "",
      bpm: 0,
      price: 0,
      jsonPeaksUrl: waveformPeaksUrl,
    }),
    [audioUrl, duration, sampleId, sampleTitle, waveformPeaksUrl]
  );

  const isCurrent = currentSample?.id?.toString() === sampleId;
  const progress = isCurrent ? state.progress : 0;
  const isPlaying = isCurrent && state.isPlaying;
  const canPlay = isPlayable && Boolean(audioUrl);

  useEffect(() => {
    const node = waveformRef.current;
    if (!node) {
      return;
    }

    const updateWidth = () => {
      const nextWidth = Math.max(48, Math.floor(node.clientWidth));
      setWaveformWidth(nextWidth);
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  const handlePlayPause = () => {
    if (!canPlay) {
      return;
    }

    if (isCurrent && state.isReady) {
      togglePlay();
      return;
    }

    play(sampleForPlayer);
  };

  const seekByClientPosition = (clientX: number, rect: DOMRect) => {
    if (!canPlay || rect.width <= 0) {
      return;
    }

    const pointer = clientX - rect.left;
    const clamped = Math.max(0, Math.min(1, pointer / rect.width));

    if (!isCurrent) {
      play(sampleForPlayer, clamped);
      return;
    }

    seekTo(clamped);
  };

  const handleWaveformClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    seekByClientPosition(event.clientX, rect);
  };

  const handleWaveformKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!canPlay) {
      return;
    }

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      handlePlayPause();
      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 0.04 : -0.04;
      const nextProgress = Math.max(0, Math.min(1, progress + delta));

      if (!isCurrent) {
        play(sampleForPlayer, nextProgress);
        return;
      }

      seekTo(nextProgress);
    }
  };

  return (
    <section className="sample-player" aria-label="Sample player">
      <div className="sample-player__row">
        <button
          type="button"
          className={`sample-player__play${isPlaying ? " sample-player__play--active" : ""}`}
          onClick={handlePlayPause}
          disabled={!canPlay}
          aria-label={isPlaying ? "Pause sample" : "Play sample"}
        >
          {isPlaying ? (
            <span className="sample-player__pause" aria-hidden="true">
              <span className="sample-player__pause-bar" />
              <span className="sample-player__pause-bar" />
            </span>
          ) : (
            <span className="sample-player__play-triangle" aria-hidden="true" />
          )}
        </button>

        <div
          className="sample-player__waveform"
          onClick={handleWaveformClick}
          ref={waveformRef}
          role="slider"
          tabIndex={0}
          aria-label="Waveform seek bar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          onKeyDown={handleWaveformKeyDown}
        >
          {waveformPeaksUrl ? (
            <WaveformFromJsonForSample
              sample={sampleForPlayer}
              peaksUrl={waveformPeaksUrl}
              width={waveformWidth}
              height={74}
              barWidth={4}
              gap={2}
              activeColor="#f4f4f4"
              inactiveColor="rgba(244, 244, 244, 0.24)"
            />
          ) : waveformData && waveformData.length > 0 ? (
            <WaveformBars
              peaks={waveformData}
              width={waveformWidth}
              height={74}
              barWidth={4}
              gap={2}
              playbackProgress={progress}
              activeColor="#f4f4f4"
              inactiveColor="rgba(244, 244, 244, 0.24)"
            />
          ) : (
            <div className="sample-player__wave-empty">Waveform unavailable</div>
          )}
        </div>
      </div>
    </section>
  );
};
