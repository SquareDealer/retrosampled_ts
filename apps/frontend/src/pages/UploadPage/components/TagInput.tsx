import React, { useState } from "react";
import { MAX_TAGS } from "../uploadConstants";
import { Icon } from "./icons";

type TagInputProps = {
  tags: string[];
  onChange: (tags: string[]) => void;
  /** Tags coming from the parent sample on a remake (rendered dashed). */
  inheritedTags?: string[];
  error?: string;
};

const normalizeTag = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9#+\-._]/g, "").slice(0, 24);

export const TagInput: React.FC<TagInputProps> = ({ tags, onChange, inheritedTags = [], error }) => {
  const [draft, setDraft] = useState("");
  const inherited = new Set(inheritedTags);
  const isFull = tags.length >= MAX_TAGS;

  const commit = () => {
    const next = normalizeTag(draft);
    setDraft("");
    if (!next || tags.includes(next) || isFull) {
      return;
    }
    onChange([...tags, next]);
  };

  return (
    <div className="upload-field">
      <span className="upload-label">
        <span>tags</span>
        <small>{inheritedTags.length ? "dashed = inherited from parent" : `up to ${MAX_TAGS}`}</small>
      </span>
      <div className="upload-chips">
        {tags.map((tag) => (
          <span
            key={tag}
            className={`upload-chip${inherited.has(tag) ? " upload-chip--inherited" : ""}`}
          >
            {tag}
            <button
              type="button"
              className="upload-chip__x"
              aria-label={`Remove tag ${tag}`}
              onClick={() => onChange(tags.filter((entry) => entry !== tag))}
            >
              <Icon.X />
            </button>
          </span>
        ))}
        {!isFull ? (
          <span className="upload-chip upload-chip--add">
            <input
              value={draft}
              placeholder="+ add tag"
              aria-label="Add tag"
              maxLength={24}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  commit();
                } else if (event.key === "Backspace" && !draft && tags.length) {
                  onChange(tags.slice(0, -1));
                }
              }}
            />
          </span>
        ) : null}
      </div>
      {error ? <span className="upload-error">{error}</span> : null}
    </div>
  );
};
