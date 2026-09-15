import React from "react";
import type { CreatorRole, SampleVisibility } from "@retrosampled/shared";
import { SampleCoverCard } from "../../../components/sample-page/SampleCoverCard";
import { SamplePlayer } from "../../../components/sample-page/SamplePlayer";
import { Icon } from "../components/icons";
import { formatSeconds } from "../uploadConstants";
import type { UploadWizard } from "../useUploadWizard";

const ROLE_LABELS: Record<CreatorRole, string> = {
  OG_CREATOR: "og",
  INHERITED_OG_CREATOR: "inherited og",
  CURRENT_CREATOR: "creator",
  COLLABORATOR: "collab",
};

const OPTIONS: Array<{ value: SampleVisibility; title: string; text: string }> = [
  {
    value: "published",
    title: "published",
    text: "in feed, search and your profile. anyone can play, like and remake it.",
  },
  {
    value: "private",
    title: "private",
    text: "only you and collaborators. shows in your library, never in feed. switch any time.",
  },
];

export const PublishStep: React.FC<{ wizard: UploadWizard }> = ({ wizard }) => {
  const { state } = wizard;
  const sample = state.sample;

  if (!sample) {
    return null;
  }

  const isOg = !sample.inheritedFrom;
  const authorNames = sample.authors.map((author) => author.name.replace(/^@/, ""));

  return (
    <>
      <div className="upload-preview">
        <div className="upload-preview__left">
          <SampleCoverCard imageUrl={sample.coverUrl} title={sample.title} />
        </div>

        <div className="upload-preview__right">
          <div className="upload-preview__head">
            <h2 className="upload-preview__title">
              {sample.title}
              {isOg ? <img className="upload-preview__og" src="/icons/og_icon.png" alt="OG sample" /> : null}
            </h2>
            <div className="upload-preview__authors">
              {authorNames.map((name, index) => (
                <React.Fragment key={name}>
                  {index > 0 ? <i>x</i> : null}
                  <span>{name}</span>
                </React.Fragment>
              ))}
            </div>
            <div className="upload-preview__badges">
              {sample.creators.flatMap((creator) =>
                creator.roles.map((role) => (
                  <span
                    key={`${creator.id}-${role}`}
                    className={`upload-badge${role === "COLLABORATOR" ? " upload-badge--muted" : ""}`}
                  >
                    {ROLE_LABELS[role]} · @{creator.username}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="upload-meta">
            <span className="upload-meta__i">
              <span>bpm</span>
              {sample.bpm || "—"}
            </span>
            <span className="upload-meta__i">
              <span>key</span>
              {sample.musicalKey || "—"}
            </span>
            {sample.sampleType ? (
              <span className="upload-meta__i">
                <span>type</span>
                {sample.sampleType}
              </span>
            ) : null}
            <span className="upload-meta__i">
              <span>length</span>
              {formatSeconds(sample.duration)}
            </span>
          </div>

          {sample.tags.length ? (
            <div className="upload-chips">
              {sample.tags.map((tag) => (
                <span key={tag} className="upload-chip">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <SamplePlayer
            sampleId={sample.id}
            sampleTitle={sample.title}
            audioUrl={sample.audioPreviewUrl}
            waveformPeaksUrl={sample.waveformPeaksUrl}
            duration={sample.duration}
            isPlayable={Boolean(sample.audioPreviewUrl)}
          />
        </div>
      </div>

      <div className="upload-visibility">
        <span className="upload-label">
          <span>visibility</span>
        </span>
        <div className="upload-visibility__options" role="radiogroup" aria-label="Visibility">
          {OPTIONS.map((option) => {
            const isOn = state.visibility === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isOn}
                className={`upload-radio${isOn ? " upload-radio--on" : ""}`}
                onClick={() => wizard.setVisibility(option.value)}
              >
                <span className="upload-radio__dot" />
                <span>
                  <p className="upload-radio__t">{option.title}</p>
                  <p className="upload-radio__d">{option.text}</p>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="upload-actions">
        <button type="button" className="upload-btn" onClick={() => wizard.goTo(2)}>
          <Icon.Back /> back
        </button>
        <div className="upload-actions__r">
          <button
            type="button"
            className="upload-btn"
            disabled={state.isPublishing}
            onClick={() => {
              void wizard.saveDraftAndLeave();
            }}
          >
            save as draft
          </button>
          <button
            type="button"
            className="upload-btn upload-btn--primary"
            disabled={state.isPublishing}
            onClick={() => {
              void wizard.publish();
            }}
          >
            {state.isPublishing ? "publishing…" : state.visibility === "published" ? "publish" : "save private"}
          </button>
        </div>
      </div>
    </>
  );
};
