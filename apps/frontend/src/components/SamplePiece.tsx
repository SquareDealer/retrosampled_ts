import React from "react";
import { Link } from "react-router-dom";
import { WaveformFromJsonForSample } from "./waveform/WaveformFromJsonForSample";
import { useAudioContextManager } from "./AudioContextManager";
import { Sample } from "../types/Sample";
import "./SampleRow.css";

interface SamplePieceProps {
  sample: Sample;
}

const getDeterministicLikesCount = (id: Sample["id"]): number => {
  const source = String(id);
  let hash = 0;

  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) % 100000;
  }

  return 10 + (hash % 990);
};

const getInitialLikesCount = (sample: Sample): number => {
  const parsedLikes = Number(sample.likesCount);

  if (Number.isFinite(parsedLikes) && parsedLikes >= 0) {
    return Math.floor(parsedLikes);
  }

  return getDeterministicLikesCount(sample.id);
};

export const SamplePiece: React.FC<SamplePieceProps> = ({ sample }) => {
  const { currentSample, state, play, seekTo } = useAudioContextManager();
  const [isLiked, setIsLiked] = React.useState(Boolean(sample.isLiked));
  const [likesCount, setLikesCount] = React.useState<number>(() => getInitialLikesCount(sample));

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

  const handleLikeClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    setIsLiked((prevLiked) => {
      setLikesCount((prevCount) => (prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1));
      return !prevLiked;
    });
  };

  // Click on entire container to play sample
  const handleContainerClick = () => {
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
          <Link
            to={`/sample/${sample.id}`}
            className="sample-row__title sample-row__title-link"
            onClick={(event) => event.stopPropagation()}
          >
            {sample.title}
          </Link>

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

      {/* RIGHT: Like */}
      <div className="sample-row__right">
        <div className="sample-row__actions">
          <span
            className={`sample-row__likes-count${
              isLiked ? " sample-row__likes-count--active" : ""
            }`}
            aria-label={`Likes ${likesCount}`}
          >
            {likesCount}
          </span>

          <button
            className={`sample-row__like${isLiked ? " sample-row__like--active" : ""}`}
            type="button"
            aria-label={isLiked ? "Unlike" : "Like"}
            onClick={handleLikeClick}
          />
        </div>
      </div>
    </div>
  );
};

export default SamplePiece;
