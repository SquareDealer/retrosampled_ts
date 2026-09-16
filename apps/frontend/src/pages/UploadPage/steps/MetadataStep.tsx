import React from "react";
import { useAuth } from "../../../auth/useAuth";
import { CoverPicker } from "../components/CoverPicker";
import { MetadataFields, TitleField } from "../components/MetadataFields";
import { ParentSampleCard } from "../components/ParentSampleCard";
import { Icon } from "../components/icons";
import type { UploadWizard } from "../useUploadWizard";

export const MetadataStep: React.FC<{ wizard: UploadWizard }> = ({ wizard }) => {
  const { state, parent } = wizard;
  const { user } = useAuth();
  const viewer = user ? { id: user.id, username: user.username } : null;

  const ogCreator =
    parent?.creators.find((creator) => creator.roles.includes("OG_CREATOR")) ?? null;
  const collabCount = state.form.collaborators.length;

  return (
    <>
      {parent ? <ParentSampleCard parent={parent} /> : null}

      <div className="upload-metadata-grid">
        <div className="upload-metadata-grid__cover upload-stack">
          <CoverPicker
            file={state.cover}
            existingUrl={state.sample?.coverUrl}
            error={state.coverError}
            onChange={wizard.selectCover}
          />
        </div>

        <div className="upload-metadata-grid__title">
          <TitleField
            id="upload-title"
            value={state.form.title}
            error={state.formErrors.title}
            onChange={(title) => wizard.updateForm({ title })}
            hint={parent ? "tip: keep the original name so people can find the lineage" : undefined}
          />
        </div>

        <div className="upload-metadata-grid__fields upload-stack">
          {parent ? (
            <div className="upload-field">
              <span className="upload-label">
                <span>credits preview</span>
              </span>
              <div className="upload-preview__badges">
                {ogCreator ? (
                  <span className="upload-badge">
                    {parent.inheritedFrom ? "inherited og" : "og"} · @{ogCreator.username}
                  </span>
                ) : null}
                {viewer ? <span className="upload-badge">creator · @{viewer.username}</span> : null}
                {collabCount ? (
                  <span className="upload-badge upload-badge--muted">collab · +{collabCount}</span>
                ) : null}
              </div>
              <span className="upload-hint">the og creator is credited automatically and can't be removed.</span>
            </div>
          ) : null}

          <MetadataFields
            form={state.form}
            errors={state.formErrors}
            onChange={wizard.updateForm}
            viewer={viewer}
            inheritedTags={parent?.tags}
            ogCreator={ogCreator ? { id: ogCreator.id, username: ogCreator.username } : null}
            fromParent={Boolean(parent)}
            hideTitle
          />
        </div>
      </div>

      <div className="upload-actions">
        <button type="button" className="upload-btn" onClick={() => wizard.goTo(1)}>
          <Icon.Back /> back
        </button>
        <div className="upload-actions__r">
          <button
            type="button"
            className="upload-btn upload-btn--ghost"
            disabled={state.isSaving}
            onClick={() => {
              void wizard.saveDraftAndLeave();
            }}
          >
            save draft
          </button>
          <button
            type="button"
            className="upload-btn upload-btn--primary"
            disabled={state.isSaving}
            onClick={() => {
              void wizard.saveMetadata({ advance: true });
            }}
          >
            {state.isSaving ? "saving…" : "continue"} <Icon.Next />
          </button>
        </div>
      </div>
    </>
  );
};
