import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SampleDetail } from "@retrosampled/shared";
import { Stepper } from "./components/Stepper";
import { DropzoneStep } from "./steps/DropzoneStep";
import { MetadataStep } from "./steps/MetadataStep";
import { ProcessingStep } from "./steps/ProcessingStep";
import { PublishStep } from "./steps/PublishStep";
import { MAX_UPLOAD_MB, formatBytes } from "./uploadConstants";
import { useUploadWizard } from "./useUploadWizard";
import "./UploadPage.css";

type UploadPageProps = {
  /** Remake mode: the parent sample (`/sample/:id/remake` passes it). */
  parent?: SampleDetail | null;
  /** Audio to preselect on step 1, e.g. a take exported from the flip editor. */
  initialFile?: File | null;
  /** Overrides the BPM inherited from the parent. */
  initialBpm?: number;
};

const COPY = {
  1: { title: "drop your sample", lede: `wav, mp3, flac or aiff · up to ${MAX_UPLOAD_MB} mb · one file per upload.` },
  2: { title: "add details", lede: "" },
  3: { title: "processing", lede: "we're rendering the waveform and reading the file. usually under a minute." },
  4: { title: "publish", lede: "this is how it'll look on the sample page." },
} as const;

const UploadPage: React.FC<UploadPageProps> = ({ parent = null, initialFile = null, initialBpm }) => {
  const navigate = useNavigate();
  const wizard = useUploadWizard({ parent, initialFile, initialBpm });
  const { state } = wizard;
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!state.error) {
      setToast(null);
      return;
    }

    setToast(state.error);
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [state.error]);

  const copy = COPY[state.step];
  const fileLabel = state.file
    ? `${state.file.name} · ${formatBytes(state.file.size)}`
    : state.sample?.audioSizeBytes
      ? `${state.sample.title} · ${formatBytes(state.sample.audioSizeBytes)}`
      : "";

  const title =
    parent && state.step === 1
      ? "drop your remake"
      : parent && state.step === 2
        ? "add remake details"
        : copy.title;

  const lede =
    state.step === 2
      ? [parent ? `/sample/${parent.id}/remake` : null, fileLabel].filter(Boolean).join(" · ")
      : copy.lede;

  return (
    <main className="upload-page" aria-busy={state.isHydrating}>
      <header className="upload-page__header">
        <p className="upload-page__eyebrow">
          upload · step {state.step} of 4
        </p>
        <h1 className="upload-page__title">{title}</h1>
        {lede ? <p className="upload-page__lede">{lede}</p> : null}
      </header>

      <Stepper step={state.step} />

      {state.isHydrating ? (
        <div className="upload-skeleton" aria-label="Loading draft" />
      ) : state.step === 1 ? (
        <DropzoneStep wizard={wizard} onCancel={() => navigate(parent ? `/sample/${parent.id}` : "/feed")} />
      ) : state.step === 2 ? (
        <MetadataStep wizard={wizard} />
      ) : state.step === 3 ? (
        <ProcessingStep wizard={wizard} />
      ) : (
        <PublishStep wizard={wizard} />
      )}

      {toast ? (
        <div className="upload-toast upload-toast--error" role="alert">
          <span>{toast}</span>
          <button type="button" className="upload-toast__close" aria-label="Dismiss" onClick={() => setToast(null)}>
            ×
          </button>
        </div>
      ) : null}
    </main>
  );
};

export default UploadPage;
