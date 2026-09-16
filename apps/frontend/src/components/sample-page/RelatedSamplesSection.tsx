import React from "react";
import { useMemo } from "react";
import { RelatedSamplesTree, SampleShort } from "@retrosampled/shared";
import SamplePiece from "../SamplePiece";

type FeedbackTone = "success" | "error";

type RelatedSamplesSectionProps = {
  relatedSamples: RelatedSamplesTree;
  onAddRemake?: () => void;
  onFeedback?: (tone: FeedbackTone, text: string) => void;
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

  const handleAddRemake = () => {
    if (onAddRemake) {
      onAddRemake();
      return;
    }

    onFeedback?.("success", "Remake creation flow will be available soon.");
  };

  const handleLikeError = (message: string) => {
    onFeedback?.("error", message);
  };

  // Likes go through SamplePiece's API-backed hook; the section only supplies the queue.
  const renderRow = (sample: SampleShort) => (
    <SamplePiece
      key={sample.id}
      sample={sample}
      variant="related"
      rowAction="open"
      maxTags={3}
      queue={allRelatedSamples}
      onLikeError={handleLikeError}
    />
  );

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
