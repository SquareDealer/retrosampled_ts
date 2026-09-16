import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

type CoverPickerProps = {
  file: File | null;
  existingUrl?: string;
  error?: string | null;
  onChange: (file: File | null) => void;
  compact?: boolean;
};

export const CoverPicker: React.FC<CoverPickerProps> = ({
  file,
  existingUrl,
  error,
  onChange,
  compact = false,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const shown = preview ?? existingUrl;

  return (
    <div className="upload-field">
      <span className="upload-label">
        <span>cover</span>
        {!compact ? <small>square · optional</small> : null}
      </span>
      <button
        type="button"
        className={`upload-cover${shown ? "" : " upload-cover--dashed"}`}
        onClick={() => inputRef.current?.click()}
        aria-label={shown ? "Change cover" : "Add cover"}
      >
        {shown ? (
          <img src={shown} alt="Cover preview" />
        ) : (
          <>
            <Icon.Image />
            <span>add cover</span>
            {!compact ? <span className="upload-cover__sub">png · jpg · webp · max 2 mb</span> : null}
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        aria-label="Cover image"
        onChange={(event) => {
          onChange(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />
      {error ? (
        <span className="upload-error">{error}</span>
      ) : file ? (
        <button type="button" className="upload-btn upload-btn--ghost upload-btn--sm" onClick={() => onChange(null)}>
          remove cover
        </button>
      ) : !compact ? (
        <span className="upload-hint">no cover? we render the waveform instead.</span>
      ) : null}
    </div>
  );
};
