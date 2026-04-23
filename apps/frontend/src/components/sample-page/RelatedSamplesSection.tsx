import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAudioContextManager } from "../AudioContextManager";
import { WaveformFromJsonForSample } from "../waveform/WaveformFromJsonForSample";
import { Sample } from "../../types/Sample";
import { RelatedSamplesTree, SampleShort } from "../../types/sampleDetail";

type FeedbackTone = "success" | "error";

type RelatedSamplesSectionProps = {
  relatedSamples: RelatedSamplesTree;
  onAddRemake?: () => void;
  onFeedback?: (tone: FeedbackTone, text: string) => void;
};

type LikeState = {
  isLiked: boolean;
  likesCount: number;
};

const formatLikes = (likesCount: number): string => {
  if (likesCount < 1000) {
    return String(likesCount);
  }

  const compact = likesCount / 1000;
  const rounded = compact >= 100 ? Math.round(compact) : Math.round(compact * 10) / 10;
  return `${rounded.toString().replace(/\.0$/, "")}k`;
};

const toAudioSample = (sample: SampleShort): Sample => {
  return {
    id: sample.id,
    authorId: sample.authorId,
    author: sample.author,
    title: sample.title,
    tags: sample.tags,
    audioUrl: sample.audioUrl,
    time: sample.time,
    key: sample.key,
    bpm: sample.bpm,
    price: sample.price,
    jsonPeaksUrl: sample.jsonPeaksUrl,
  };
};

const SectionLabel: React.FC<{ text: string }> = ({ text }) => {
  return <h3 className="related-samples__label">{text}</h3>;
};

type RelatedSampleRowProps = {
  sample: SampleShort;
  likesCount: number;
  isLiked: boolean;
  onToggleLike: (sampleId: string) => void;
};

const RelatedSampleRow: React.FC<RelatedSampleRowProps> = ({
  sample,
  likesCount,
  isLiked,
  onToggleLike,
}) => {
  const navigate = useNavigate();
  const { currentSample, state, play, seekTo, togglePlay } = useAudioContextManager();

  const waveformRef = useRef<HTMLDivElement | null>(null);
  const [waveformWidth, setWaveformWidth] = useState(220);

  const audioSample = useMemo(() => toAudioSample(sample), [sample]);
  const isCurrent = currentSample?.id?.toString() === sample.id;
  const isPlaying = isCurrent && state.isPlaying;
  const progress = isCurrent ? state.progress : 0;

  const visibleTags = sample.tags.slice(0, 3);
  const hiddenTagsCount = Math.max(0, sample.tags.length - visibleTags.length);

  useEffect(() => {
    const node = waveformRef.current;
    if (!node) {
      return;
    }

    const updateWidth = () => {
      const nextWidth = Math.max(40, Math.floor(node.clientWidth));
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

  const handleOpenSample = () => {
    navigate(`/sample/${sample.id}`);
  };

  const handlePlayClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (isCurrent && state.isReady) {
      togglePlay();
      return;
    }

    play(audioSample);
  };

  const seekByClientX = (clientX: number, rect: DOMRect) => {
    if (rect.width <= 0) {
      return;
    }

    const pointer = clientX - rect.left;
    const clamped = Math.max(0, Math.min(1, pointer / rect.width));

    if (!isCurrent || !state.isReady) {
      play(audioSample, clamped);
      return;
    }

    seekTo(clamped);
  };

  const handleWaveformClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    seekByClientX(event.clientX, rect);
  };

  const handleWaveformKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();

      if (isCurrent && state.isReady) {
        togglePlay();
      } else {
        play(audioSample);
      }

      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 0.04 : -0.04;
      const nextProgress = Math.max(0, Math.min(1, progress + delta));

      if (!isCurrent || !state.isReady) {
        play(audioSample, nextProgress);
        return;
      }

      seekTo(nextProgress);
    }
  };

  const handleLike = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onToggleLike(sample.id);
  };

  return (
    <article
      className="sample-row related-samples__row"
      onClick={handleOpenSample}
      role="link"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          handleOpenSample();
        }
      }}
      aria-label={`Open sample ${sample.title}`}
    >
      <div className="sample-row__left related-samples__left">
        <img
          className="sample-row__avatar related-samples__avatar"
          src="/img/avatar.jpg"
          alt={sample.author}
        />

        <div className="sample-row__info">
          <a
            href={`/user/${sample.authorId}`}
            className="sample-row__author"
            onClick={(event) => event.stopPropagation()}
          >
            {sample.author}
          </a>

          <Link
            to={`/sample/${sample.id}`}
            className="sample-row__title sample-row__title-link"
            onClick={(event) => event.stopPropagation()}
          >
            {sample.title}
          </Link>

          <div className="sample-row__tags">
            {visibleTags.map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}

            {hiddenTagsCount > 0 ? <span className="tag">+{hiddenTagsCount}</span> : null}
          </div>
        </div>
      </div>

      <div className="sample-row__center related-samples__center">
        <div className="sample-row__media related-samples__media">
          <button
            className="sample-row__play"
            onClick={handlePlayClick}
            type="button"
            aria-label={isPlaying ? "Pause sample" : "Play sample"}
          >
            <img
              className="sample-row__play-icon"
              src={isPlaying ? "/img/pause_icon.png" : "/img/play_icon.png"}
              alt={isPlaying ? "Pause" : "Play"}
            />
          </button>

          <div
            className="sample-row__waveform related-samples__waveform"
            onClick={handleWaveformClick}
            ref={waveformRef}
            role="slider"
            tabIndex={0}
            aria-label={`Seek waveform for ${sample.title}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            onKeyDown={handleWaveformKeyDown}
          >
            {sample.jsonPeaksUrl ? (
              <WaveformFromJsonForSample
                sample={audioSample}
                peaksUrl={sample.jsonPeaksUrl}
                width={waveformWidth}
                height={48}
                barWidth={3}
                gap={2}
                activeColor="#f4f4f4"
                inactiveColor="rgba(244, 244, 244, 0.24)"
              />
            ) : (
              <div className="sample-row__wave-placeholder" />
            )}
          </div>
        </div>

        <div className="sample-row__metadata related-samples__metadata">
          <div className="sample-row__time related-samples__metadata-time">{sample.time}</div>
        </div>
      </div>

      <div className="sample-row__right related-samples__right">
        <span
          className={`related-samples__likes${isLiked ? " related-samples__likes--active" : ""}`}
          aria-label={`Likes ${likesCount}`}
        >
          {formatLikes(likesCount)}
        </span>

        <button
          className={`sample-row__like related-samples__like${
            isLiked ? " sample-row__like--active related-samples__like--active" : ""
          }`}
          type="button"
          aria-label={isLiked ? "Unlike sample" : "Like sample"}
          onClick={handleLike}
        />
      </div>
    </article>
  );
};

export const RelatedSamplesSection: React.FC<RelatedSamplesSectionProps> = ({
  relatedSamples,
  onAddRemake,
  onFeedback,
}) => {
  const allRelatedSamples = useMemo(() => {
    const items: SampleShort[] = [];

    if (relatedSamples.rootOriginal) {
      items.push(relatedSamples.rootOriginal);
    }

    if (relatedSamples.inheritedOriginal) {
      items.push(relatedSamples.inheritedOriginal);
    }

    items.push(...relatedSamples.remakes);
    return items;
  }, [relatedSamples]);

  const [likesById, setLikesById] = useState<Record<string, LikeState>>({});

  useEffect(() => {
    const nextState: Record<string, LikeState> = {};

    allRelatedSamples.forEach((sample) => {
      nextState[sample.id] = {
        isLiked: sample.isLiked,
        likesCount: sample.likesCount,
      };
    });

    setLikesById(nextState);
  }, [allRelatedSamples]);

  const toggleLike = (sampleId: string) => {
    setLikesById((current) => {
      const existing = current[sampleId];
      if (!existing) {
        return current;
      }

      const nextLiked = !existing.isLiked;
      const nextCount = nextLiked
        ? existing.likesCount + 1
        : Math.max(0, existing.likesCount - 1);

      return {
        ...current,
        [sampleId]: {
          isLiked: nextLiked,
          likesCount: nextCount,
        },
      };
    });
  };

  const getLikeState = (sample: SampleShort): LikeState => {
    return (
      likesById[sample.id] ?? {
        isLiked: sample.isLiked,
        likesCount: sample.likesCount,
      }
    );
  };

  const handleAddRemake = () => {
    if (onAddRemake) {
      onAddRemake();
      return;
    }

    onFeedback?.("success", "Remake creation flow will be available soon.");
  };

  return (
    <section className="related-samples" aria-label="Related samples">
      <h2 className="related-samples__title">Related samples</h2>

      {relatedSamples.rootOriginal ? (
        <div className="related-samples__group">
          <SectionLabel text="root og" />
          <RelatedSampleRow
            sample={relatedSamples.rootOriginal}
            {...getLikeState(relatedSamples.rootOriginal)}
            onToggleLike={toggleLike}
          />
        </div>
      ) : null}

      {relatedSamples.inheritedOriginal ? (
        <div className="related-samples__group">
          <SectionLabel text="inherited og" />
          <RelatedSampleRow
            sample={relatedSamples.inheritedOriginal}
            {...getLikeState(relatedSamples.inheritedOriginal)}
            onToggleLike={toggleLike}
          />
        </div>
      ) : null}

      <div className="related-samples__group">
        <SectionLabel text="Current sample remakes" />

        {relatedSamples.remakes.length > 0 ? (
          relatedSamples.remakes.map((sample) => (
            <RelatedSampleRow
              key={sample.id}
              sample={sample}
              {...getLikeState(sample)}
              onToggleLike={toggleLike}
            />
          ))
        ) : (
          <p className="related-samples__empty">No remakes yet. Be the first to add one.</p>
        )}
      </div>

      <button
        type="button"
        className="related-samples__add-remake"
        onClick={handleAddRemake}
      >
        <span className="related-samples__add-icon" aria-hidden="true">
          +
        </span>
        Add your remake
      </button>
    </section>
  );
};
