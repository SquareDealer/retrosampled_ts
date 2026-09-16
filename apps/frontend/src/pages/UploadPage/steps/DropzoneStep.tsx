import React, { useRef, useState } from "react";
import { Icon } from "../components/icons";
import { MAX_UPLOAD_MB, formatBytes } from "../uploadConstants";
import type { UploadWizard } from "../useUploadWizard";

export const DropzoneStep: React.FC<{ wizard: UploadWizard; onCancel: () => void }> = ({
  wizard,
  onCancel,
}) => {
  const { state } = wizard;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const openPicker = () => inputRef.current?.click();

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) {
      wizard.selectFile(dropped);
    }
  };

  const canContinue = Boolean(state.file) && !state.fileError && !state.isUploading;

  return (
    <>
      <div
        className={`upload-dropzone${isDragging ? " upload-dropzone--active" : ""}${
          state.fileError ? " upload-dropzone--error" : ""
        }${state.file ? " upload-dropzone--filled" : ""}`}
        role={state.file ? undefined : "button"}
        tabIndex={state.file ? undefined : 0}
        aria-label="Drop audio here or browse files"
        onClick={state.file ? undefined : openPicker}
        onKeyDown={(event) => {
          if (!state.file && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!state.isUploading) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={state.isUploading ? undefined : handleDrop}
        data-testid="upload-dropzone"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".wav,.mp3,.flac,.aiff,.aif,audio/*"
          aria-label="Audio file"
          data-testid="upload-file-input"
          onChange={(event) => {
            wizard.selectFile(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
        />

        {state.file ? (
          <>
            <div className="upload-filerow">
              <span style={{ display: "inline-flex", color: "#bdbdbd" }}>
                <Icon.File />
              </span>
              <span className="upload-filerow__n" title={state.file.name}>
                {state.file.name}
              </span>
              <span className="upload-filerow__m">{formatBytes(state.file.size)}</span>
              {!state.isUploading ? (
                <button
                  type="button"
                  className="upload-btn upload-btn--ghost upload-btn--sm"
                  onClick={wizard.clearFile}
                >
                  remove
                </button>
              ) : null}
            </div>

            {state.isUploading ? (
              <>
                <div className="upload-progress" aria-label="Upload progress">
                  <span
                    className={`upload-progress__fill${
                      state.uploadPercent === null ? " upload-progress__fill--indeterminate" : ""
                    }`}
                    style={state.uploadPercent === null ? undefined : { width: `${state.uploadPercent}%` }}
                  />
                </div>
                <span className="upload-hint">
                  {state.uploadPercent !== null && state.uploadPercent < 100
                    ? `uploading · ${state.uploadPercent}%`
                    : "uploaded — creating your draft…"}
                </span>
              </>
            ) : state.fileError ? (
              <div className="upload-error" style={{ display: "flex", gap: 8, alignItems: "flex-start", lineHeight: 1.5 }}>
                <span style={{ display: "inline-flex", flex: "0 0 auto" }}>
                  <Icon.Warn />
                </span>
                <span>{state.fileError}</span>
              </div>
            ) : (
              <span className="upload-hint upload-hint--ok" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                <Icon.Check /> ready — continue to add details
              </span>
            )}

            {state.fileError && !state.isUploading ? (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" className="upload-btn upload-btn--sm" onClick={openPicker}>
                  choose another file
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <span style={{ display: "inline-flex" }}>
              <Icon.Up />
            </span>
            <div className="upload-dropzone__t">{isDragging ? "release to add" : "drag & drop audio here"}</div>
            <div className="upload-dropzone__s">
              or{" "}
              <a
                href="#browse"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openPicker();
                }}
              >
                browse files
              </a>
            </div>
            <div className="upload-dropzone__formats">wav · mp3 · flac · aiff · max {MAX_UPLOAD_MB} mb</div>
          </>
        )}
      </div>

      <div className="upload-actions">
        <button
          type="button"
          className="upload-btn"
          onClick={state.isUploading ? wizard.cancelUpload : onCancel}
        >
          cancel
        </button>
        <div className="upload-actions__r">
          <button
            type="button"
            className="upload-btn upload-btn--primary"
            disabled={!canContinue}
            onClick={() => {
              void wizard.continueFromDropzone();
            }}
          >
            {state.isUploading ? "uploading…" : "continue"} <Icon.Next />
          </button>
        </div>
      </div>
    </>
  );
};
