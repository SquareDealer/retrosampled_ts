import React from "react";

export type SampleTagsProps = {
  tags: string[];
  onTagClick?: (tag: string) => void;
};

export const SampleTags: React.FC<SampleTagsProps> = ({ tags, onTagClick }) => {
  return (
    <section className="sample-tags" aria-label="Sample tags">
      {tags.map((tag) => {
        const isInteractive = Boolean(onTagClick);
        return (
          <button
            key={tag}
            type="button"
            className="sample-tags__chip"
            onClick={() => onTagClick?.(tag)}
            disabled={!isInteractive}
            aria-label={`Tag ${tag}`}
          >
            {tag}
          </button>
        );
      })}
    </section>
  );
};
