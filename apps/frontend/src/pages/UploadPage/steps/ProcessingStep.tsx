import React, { useEffect, useMemo, useState } from "react";
import { WaveformBars } from "../../../components/waveform/WaveformBars";
import { Icon, initialsOf } from "../components/icons";
import { formatBytes, formatSeconds } from "../uploadConstants";
import type { UploadWizard } from "../useUploadWizard";

const PLACEHOLDER_BARS = Array.from({ length: 96 }, (_, index) => {
  const wave = Math.sin(index / 3.1) * 0.35 + Math.sin(index / 1.7) * 0.2;
  return 0.45 + wave * 0.5 + ((index * 37) % 11) / 40;
});

const useElementWidth = (fallback: number) => {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    if (!node) return;
    const update = () => setWidth(Math.max(120, Math.floor(node.clientWidth)));
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return { ref: setNode, width };
};

export const ProcessingStep: React.FC<{ wizard: UploadWizard }> = ({ wizard }) => {
  const { state } = wizard;
  const sample = state.sample;
  const status = sample?.status ?? "PROCESSING";
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const { ref, width } = useElementWidth(720);

  const peaksUrl = sample?.waveformPeaksUrl;

  useEffect(() => {
    if (!peaksUrl) {
      setPeaks(null);
      return;
    }

    let cancelled = false;
    void fetch(peaksUrl)
      .then((response) => (response.ok ? response.json() : null))
      .then((json: { data?: number[] | number[][] } | null) => {
        if (cancelled || !json?.data) return;
        const data = Array.isArray(json.data[0]) ? (json.data as number[][])[0] : (json.data as number[]);
        setPeaks(data);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [peaksUrl]);

  const isFailed = status === "FAILED";
  const isDone = status !== "PROCESSING" && !isFailed;
  const hasAudio = Boolean(sample?.audioPreviewUrl);
  const hasDuration = typeof sample?.duration === "number";
  const hasPeaks = Boolean(peaksUrl);

  const progress = isFailed ? 38 : isDone ? 100 : hasDuration ? 80 : hasAudio ? 45 : 15;

  const stepClass = (done: boolean, active: boolean) =>
    isFailed && !done ? "is-failed" : done ? "is-done" : active ? "is-active" : "is-pending";

  const owner = sample?.ownerUsername ?? sample?.authors[0]?.name?.replace(/^@/, "") ?? "";
  const fileLabel = useMemo(() => {
    const parts = [state.file?.name];
    if (sample?.audioSizeBytes) parts.push(formatBytes(sample.audioSizeBytes));
    else if (state.file) parts.push(formatBytes(state.file.size));
    return parts.filter(Boolean).join(" · ");
  }, [sample?.audioSizeBytes, state.file]);

  const statusLabel = isFailed ? "failed" : isDone ? "ready" : "processing";
  const statusClass = isFailed ? "failed" : isDone ? "published" : "processing";

  return (
    <>
      <div className="upload-card" aria-live="polite">
        <div className="upload-card__head">
          <div className="upload-cover upload-cover--art upload-card__cover">
            {sample?.coverUrl ? <img src={sample.coverUrl} alt="" /> : initialsOf(sample?.title ?? "")}
          </div>
          <div className="upload-card__info">
            <span className="upload-card__owner">@{owner}</span>
            <span className="upload-card__title">{sample?.title}</span>
            <span className="upload-card__file">{fileLabel || "uploaded audio"}</span>
          </div>
          <span className={`library-status library-status--${statusClass}`}>{statusLabel}</span>
        </div>

        <div className="upload-card__wave" ref={ref}>
          <WaveformBars
            peaks={peaks ?? PLACEHOLDER_BARS}
            width={width}
            height={74}
            barWidth={3}
            gap={3}
            playbackProgress={peaks ? 1 : isFailed ? 0 : 0.62}
            activeColor="#f4dd00"
            inactiveColor="#ffffff20"
          />
        </div>

        <div className="upload-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <span
            className={`upload-progress__fill${isFailed ? " upload-progress__fill--err" : ""}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {isFailed ? (
          <>
            <div className="upload-card__failure">
              <Icon.Warn />
              <span>
                processing failed — {sample?.processingError?.toLowerCase() ?? "the audio couldn't be decoded"}. your
                details are saved; retry with the same file or delete the upload.
              </span>
            </div>
            <div className="upload-card__end">
              <button
                type="button"
                className="upload-btn upload-btn--danger"
                onClick={() => {
                  void wizard.remove();
                }}
              >
                delete
              </button>
              <button
                type="button"
                className="upload-btn upload-btn--primary"
                onClick={() => {
                  void wizard.retry();
                }}
              >
                retry
              </button>
            </div>
          </>
        ) : (
          <>
            <ul className="upload-plist">
              <li className={stepClass(hasAudio, !hasAudio)}>
                <span className="upload-plist__icon">{hasAudio ? <Icon.Check /> : <Icon.Spinner />}</span>
                <span>uploaded</span>
              </li>
              <li className={stepClass(hasDuration, hasAudio && !hasDuration)}>
                <span className="upload-plist__icon">
                  {hasDuration ? <Icon.Check /> : hasAudio ? <Icon.Spinner /> : null}
                </span>
                <span>
                  {hasDuration
                    ? `decoded · ${formatSeconds(sample?.duration)}${sample?.audioMime ? ` · ${sample.audioMime.replace("audio/", "")}` : ""}`
                    : "decoding audio"}
                </span>
              </li>
              <li className={stepClass(hasPeaks || isDone, hasDuration && !hasPeaks && !isDone)}>
                <span className="upload-plist__icon">
                  {hasPeaks || isDone ? <Icon.Check /> : hasDuration ? <Icon.Spinner /> : null}
                </span>
                <span>{hasPeaks ? "waveform rendered" : isDone ? "waveform unavailable for this format" : "rendering waveform"}</span>
              </li>
              <li className={stepClass(isDone, false)}>
                <span className="upload-plist__icon">{isDone ? <Icon.Check /> : null}</span>
                <span>
                  {isDone
                    ? `details saved · ${sample?.bpm || "—"} bpm · ${sample?.musicalKey || "—"}`
                    : "saving bpm & key"}
                </span>
              </li>
            </ul>

            <div className="upload-card__foot">
              <span className="upload-hint">
                {isDone
                  ? "all set — preview and publish."
                  : "you can close this — we'll keep it under continue working in your library."}
              </span>
              <button
                type="button"
                className="upload-btn upload-btn--primary"
                disabled={!isDone}
                onClick={() => wizard.goTo(4)}
              >
                continue <Icon.Next />
              </button>
            </div>
          </>
        )}
      </div>

      <div className="upload-actions">
        <button type="button" className="upload-btn" onClick={() => wizard.goTo(2)}>
          <Icon.Back /> back to details
        </button>
        <div className="upload-actions__r">
          <button
            type="button"
            className="upload-btn upload-btn--ghost"
            onClick={() => {
              void wizard.saveDraftAndLeave();
            }}
          >
            save draft
          </button>
        </div>
      </div>
    </>
  );
};
