import React from "react";
import { WaveformFromJsonForSample } from "./waveform/WaveformFromJsonForSample";
import { useAudioContextManager } from "./AudioContextManager";
import { Sample } from "../types/Sample";

interface SamplePieceProps {
  sample: Sample;
}

export const SamplePiece: React.FC<SamplePieceProps> = ({ sample }) => {
  const { currentSample, state, play, seekTo } = useAudioContextManager();

  const isCurrent = currentSample?.id === sample.id;
  const isPlaying = isCurrent && state.isPlaying;
  const authorName = sample.author || "Unknown Artist";

  // Click on waveform (seek / play-with-progress)
  const handleWaveformSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const p = x / rect.width;
    const clamped = Math.max(0, Math.min(1, p));
    if (!isCurrent) {
      play(sample, clamped);
    } else {
      if (state.isReady) {
        seekTo(clamped);
      }
    }
  };

  // Play/Pause button handler
  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    play(sample);
  };

  // Click on entire container to play sample
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Не запускаем, если уже играет этот семпл
    if (!isCurrent) {
      play(sample);
    }
  };

  return (
    <div className="sample-row" onClick={handleContainerClick} style={{ cursor: "pointer" }}>
      {/* LEFT: Avatar, Author, Title, Tags */}
      <div className="sample-row__left">
        <img
          className="sample-row__avatar"
          src="/img/avatar.jpg" // Placeholder avatar
          alt={authorName}
        />

        <div className="sample-row__info">
          <a href={`/user/${sample.authorId}`} className="sample-row__author">
            {authorName}
          </a>
          <div className="sample-row__title">{sample.title}</div>

          <div className="sample-row__tags">
            {sample.tags.map((tag, index) => (
              <span className="tag" key={index}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* CENTER: Waveform + Metadata */}
      <div className="sample-row__center">
        <div className="sample-row__media">
          {/* Play Button */}
          <button className="sample-row__play" onClick={handlePlayClick}>
            <img 
                className="sample-row__play-icon" 
                src={isPlaying ? "/img/pause_icon.png" : "/img/play_icon.png"} 
                alt={isPlaying ? "Pause" : "Play"} 
            />
          </button>

          {/* Waveform */}
          <div
            className="sample-row__waveform"
            onClick={handleWaveformSeek}
            style={{ cursor: "pointer" }}
          >
            <WaveformFromJsonForSample
              sample={sample}
              peaksUrl={sample.jsonPeaksUrl ?? ""}
              width={200}
              height={50}
              barWidth={3}
              gap={2}
              activeColor="#ffffff"
              inactiveColor="rgba(255,255,255,0.3)"
            />
          </div>
        </div>

        <div className="sample-row__metadata">
          <div className="sample-row__time">{sample.time}</div>
          <div className="sample-row__key">{sample.key}</div>
          <div className="sample-row__bpm">{sample.bpm}</div>
        </div>
      </div>

      {/* RIGHT: Price + Like */}
      <div className="sample-row__right">
        <div className="sample-row__actions">
          <div className="sample-row__price">
            <span className="sample-row__coin">
              <img
                className="sample-row__coin-icon"
                src="/img/gold_icon.png"
                alt="gold"
              />
            </span>
            <span>{sample.price}</span>
          </div>

          <button className="sample-row__like" type="button" aria-label="Like" />
        </div>
      </div>
    </div>
  );
};

export default SamplePiece;
