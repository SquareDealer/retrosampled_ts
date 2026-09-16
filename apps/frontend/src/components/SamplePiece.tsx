import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { WaveformFromJsonForSample } from "./waveform/WaveformFromJsonForSample";
import { useAudioContextManager } from "./AudioContextManager";
import { Sample } from "@retrosampled/shared";
import { HeartIcon, PauseIcon, PlayIcon } from "./icons";
import { useElementWidth } from "../hooks/useElementWidth";
import { useLikeSample } from "../hooks/useLikeSample";
import { formatCompactNumber } from "../utils/formatCompactNumber";
import avatarImage from "../assets/img/avatar.png";
import "./SampleRow.css";

export type SamplePieceVariant = "default" | "compact" | "related";
export type SamplePieceRowAction = "play" | "open";

interface SamplePieceProps {
  sample: Sample;
  queue?: Sample[];
  /** Visual variant; adds `sample-row--compact` / `sample-row--related`. */
  variant?: SamplePieceVariant;
  /** Legacy alias for `variant="compact"`. */
  compact?: boolean;
  remakesExpanded?: boolean;
  onRemakesToggle?: () => void;
  /** "play" (default): clicking the row plays it. "open": row is a link to the sample page. */
  rowAction?: SamplePieceRowAction;
  /** When set, only the first N tags are shown, followed by a "+N" tag. */
  maxTags?: number;
  /** Controlled like state. When `onLikeToggle` is absent, `useLikeSample` (API-backed) is used. */
  isLiked?: boolean;
  likesCount?: number;
  onLikeToggle?: (id: string) => void;
  /** Called with a readable message when the API like toggle fails (uncontrolled mode). */
  onLikeError?: (message: string) => void;
  showLikes?: boolean;
  /** Defaults: 50 (default), 40 (compact), 48 (related). */
  waveformHeight?: number;
}

const DEFAULT_WAVEFORM_HEIGHT: Record<SamplePieceVariant, number> = {
  default: 50,
  compact: 40,
  related: 48,
};

const SEEK_STEP = 0.04;

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

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const SamplePiece: React.FC<SamplePieceProps> = ({
  sample,
  queue,
  variant: variantProp,
  compact = false,
  remakesExpanded = false,
  onRemakesToggle,
  rowAction = "play",
  maxTags,
  isLiked: isLikedProp,
  likesCount: likesCountProp,
  onLikeToggle,
  onLikeError,
  showLikes = true,
  waveformHeight: waveformHeightProp,
}) => {
  const navigate = useNavigate();
  const { currentSample, state, play, seekTo, togglePlay } = useAudioContextManager();
  const [waveformRef, waveformWidth] = useElementWidth<HTMLDivElement>(48, 200);

  const variant: SamplePieceVariant = variantProp ?? (compact ? "compact" : "default");
  const isCompact = variant === "compact";
  const waveformHeight = waveformHeightProp ?? DEFAULT_WAVEFORM_HEIGHT[variant];

  // Like state: controlled when `onLikeToggle` is provided, otherwise the shared
  // API-backed optimistic hook (guests get the auth modal, failures roll back).
  const isControlledLike = typeof onLikeToggle === "function";
  const initialLikesCount = React.useMemo(() => getInitialLikesCount(sample), [sample]);
  const apiLike = useLikeSample(
    String(sample.id),
    { isLiked: sample.isLiked, likesCount: initialLikesCount },
    { onError: onLikeError }
  );
  const isLiked = isControlledLike ? Boolean(isLikedProp) : apiLike.isLiked;
  const likesCount = isControlledLike
    ? likesCountProp ?? initialLikesCount
    : apiLike.likesCount;

  const isCurrent = Boolean(currentSample) && String(currentSample?.id) === String(sample.id);
  const isPlaying = isCurrent && state.isPlaying;
  const progress = isCurrent ? state.progress : 0;
  const authorName = sample.author || "Unknown Artist";
  const remakesCount = sample.remakesCount ?? sample.remakes?.length ?? 0;
  const hasRemakes = remakesCount > 0 && Boolean(onRemakesToggle);

  const visibleTags = typeof maxTags === "number" ? sample.tags.slice(0, maxTags) : sample.tags;
  const hiddenTagsCount = sample.tags.length - visibleTags.length;

  const openSample = () => {
    navigate(`/sample/${sample.id}`);
  };

  /** Play/pause toggle used by the play button, waveform keyboard and the row (play action). */
  const togglePlayback = () => {
    if (isCurrent && state.isReady) {
      togglePlay();
      return;
    }

    play(sample, { queue });
  };

  const seekToProgress = (nextProgress: number) => {
    const clamped = clamp01(nextProgress);

    if (!isCurrent || !state.isReady) {
      play(sample, { startProgress: clamped, queue });
      return;
    }

    seekTo(clamped);
  };

  // Click on waveform (seek / play-with-progress)
  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }

    seekToProgress((e.clientX - rect.left) / rect.width);
  };

  const handleWaveformKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      togglePlayback();
      return;
    }

    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.key === "ArrowRight" ? SEEK_STEP : -SEEK_STEP;
      seekToProgress(progress + delta);
    }
  };

  const handlePlayClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    togglePlayback();
  };

  const handleLikeClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    if (isControlledLike) {
      onLikeToggle(String(sample.id));
      return;
    }

    void apiLike.toggle();
  };

  const handleRemakesToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onRemakesToggle?.();
  };

  const handleRowClick = () => {
    if (rowAction === "open") {
      openSample();
      return;
    }

    // Do not restart a sample that is already current
    if (!isCurrent) {
      play(sample, { queue });
    }
  };

  const handleRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && e.target === e.currentTarget) {
      e.preventDefault();
      openSample();
    }
  };

  const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

  const rowClassName = `sample-row${
    variant !== "default" ? ` sample-row--${variant}` : ""
  }`;

  const rowLinkProps =
    rowAction === "open"
      ? {
          role: "link",
          tabIndex: 0,
          "aria-label": `Open sample ${sample.title}`,
          onKeyDown: handleRowKeyDown,
        }
      : {};

  return (
    <div className={`sample-row-shell sample-row-shell--${variant}`}>
      <div className={rowClassName} onClick={handleRowClick} {...rowLinkProps}>
        {/* LEFT: Avatar, Author, Title, Tags */}
        <div className="sample-row__left">
          {variant === "default" && (
            <div className="sample-row__remakes-slot">
              {hasRemakes && (
                <button
                  className={`sample-row__remakes-toggle${
                    remakesExpanded ? " sample-row__remakes-toggle--expanded" : ""
                  }`}
                  type="button"
                  aria-expanded={remakesExpanded}
                  aria-label={remakesExpanded ? "Hide remakes" : `Show ${remakesCount} remakes`}
                  onClick={handleRemakesToggle}
                >
                  &gt;
                </button>
              )}
            </div>
          )}

          <img
            className="sample-row__avatar"
            src={avatarImage} // Placeholder avatar
            alt={authorName}
          />

          <div className="sample-row__info">
            <Link
              to={`/user/${sample.authorId}`}
              className="sample-row__author"
              onClick={stopPropagation}
            >
              {authorName}
            </Link>
            <Link
              to={`/sample/${sample.id}`}
              className="sample-row__title sample-row__title-link"
              onClick={stopPropagation}
            >
              {sample.title}
            </Link>

            <div className="sample-row__tags">
              {visibleTags.map((tag, index) => (
                <span className="tag" key={`${tag}-${index}`}>
                  {tag}
                </span>
              ))}
              {hiddenTagsCount > 0 && (
                <span className="tag" aria-label={`${hiddenTagsCount} more tags`}>
                  +{hiddenTagsCount}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CENTER: Waveform + Metadata */}
        <div className="sample-row__center">
          <div className="sample-row__media">
            <button
              className="sample-row__play"
              type="button"
              aria-label={isPlaying ? "Pause sample" : "Play sample"}
              onClick={handlePlayClick}
            >
              {isPlaying ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
            </button>

            <div
              className="sample-row__waveform"
              ref={waveformRef}
              onClick={handleWaveformClick}
              onKeyDown={handleWaveformKeyDown}
              role="slider"
              tabIndex={0}
              aria-label={`Seek waveform for ${sample.title}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
            >
              {sample.jsonPeaksUrl ? (
                <WaveformFromJsonForSample
                  sample={sample}
                  peaksUrl={sample.jsonPeaksUrl}
                  width={waveformWidth}
                  height={waveformHeight}
                  barWidth={isCompact ? 2 : 3}
                  gap={2}
                  activeColor="#ffffff"
                  inactiveColor="rgba(255,255,255,0.3)"
                />
              ) : (
                <div className="sample-row__wave-placeholder" />
              )}
            </div>
          </div>

          <div className="sample-row__metadata">
            <div className="sample-row__time">{sample.time}</div>
            <div className="sample-row__key">{sample.key}</div>
            <div className="sample-row__bpm">{sample.bpm}</div>
          </div>
        </div>

        {/* RIGHT: Like */}
        {showLikes && (
          <div className="sample-row__right">
            <div className="sample-row__actions">
              <span
                className={`sample-row__likes-count${
                  isLiked ? " sample-row__likes-count--active" : ""
                }`}
                aria-label={`Likes ${likesCount}`}
              >
                {formatCompactNumber(likesCount)}
              </span>

              <button
                className={`sample-row__like${isLiked ? " sample-row__like--active" : ""}`}
                type="button"
                aria-label={isLiked ? "Unlike sample" : "Like sample"}
                aria-pressed={isLiked}
                onClick={handleLikeClick}
              >
                <HeartIcon filled={isLiked} size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SamplePiece;
