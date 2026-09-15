import React from "react";
import { useEffect, useMemo, useState } from "react";
import SamplePiece from "../SamplePiece";
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

const SectionLabel: React.FC<{ text: string }> = ({ text }) => {
  return <h3 className="related-samples__label">{text}</h3>;
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

  const renderRow = (sample: SampleShort) => {
    const like = getLikeState(sample);

    return (
      <SamplePiece
        key={sample.id}
        sample={sample}
        variant="related"
        rowAction="open"
        maxTags={3}
        queue={allRelatedSamples}
        isLiked={like.isLiked}
        likesCount={like.likesCount}
        onLikeToggle={toggleLike}
      />
    );
  };

  return (
    <section className="related-samples" aria-label="Related samples">
      <h2 className="related-samples__title">Related samples</h2>

      {relatedSamples.rootOriginal ? (
        <div className="related-samples__group">
          <SectionLabel text="root og" />
          {renderRow(relatedSamples.rootOriginal)}
        </div>
      ) : null}

      {relatedSamples.inheritedOriginal ? (
        <div className="related-samples__group">
          <SectionLabel text="inherited og" />
          {renderRow(relatedSamples.inheritedOriginal)}
        </div>
      ) : null}

      <div className="related-samples__group">
        <SectionLabel text="Current sample remakes" />

        {relatedSamples.remakes.length > 0 ? (
          relatedSamples.remakes.map(renderRow)
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
