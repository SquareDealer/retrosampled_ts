import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { analyzeAudioFile, WaveformPeaks } from "../../utils/analyzeAudioFile";
import { WaveformBars } from "../../components/waveform/WaveformBars";
import { uploadSample } from "../../api/upload";
import "./UploadPage.css";

type UploadPageProps = {
  isAuthorized: boolean;
  onSignInClick: () => void;
};

type Analyzed = {
  durationSec: number;
  peaks: WaveformPeaks;
};

const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const UploadPage: React.FC<UploadPageProps> = ({
  isAuthorized,
  onSignInClick,
}) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [analyzed, setAnalyzed] = useState<Analyzed | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [bpm, setBpm] = useState("");
  const [musicalKey, setMusicalKey] = useState("");
  const [accessType, setAccessType] = useState<"free" | "premium">("free");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (selected: File | undefined) => {
    setError(null);
    setAnalyzed(null);
    if (!selected) return;

    setFile(selected);
    if (!title) {
      setTitle(selected.name.replace(/\.[^.]+$/, ""));
    }

    setAnalyzing(true);
    try {
      const result = await analyzeAudioFile(selected);
      setAnalyzed(result);
    } catch {
      setError("Could not read this audio file. Try a WAV or MP3.");
      setFile(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!file || !analyzed) {
      setError("Choose an audio file first.");
      return;
    }
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await uploadSample({
        file,
        title: title.trim(),
        tags: tags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
        bpm: bpm ? Number(bpm) : undefined,
        key: musicalKey.trim() || undefined,
        accessType,
        durationSec: analyzed.durationSec,
        peaks: analyzed.peaks,
      });
      navigate(`/sample/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="upload-page">
        <div className="upload-card upload-card--gate">
          <h1>Upload a sample</h1>
          <p>You need an account to upload samples.</p>
          <button type="button" className="upload-btn" onClick={onSignInClick}>
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="upload-page">
      <form className="upload-card" onSubmit={handleSubmit}>
        <h1>Upload a sample</h1>

        <div
          className="upload-dropzone"
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            hidden
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {file ? (
            <div className="upload-file">
              <span className="upload-file__name">{file.name}</span>
              {analyzing && <span className="upload-file__hint">Analyzing…</span>}
              {analyzed && (
                <span className="upload-file__hint">
                  {formatDuration(analyzed.durationSec)}
                </span>
              )}
            </div>
          ) : (
            <span className="upload-dropzone__hint">
              Click to choose an audio file (WAV, MP3, …)
            </span>
          )}
        </div>

        {analyzed && (
          <div className="upload-waveform">
            <WaveformBars
              peaks={analyzed.peaks.data}
              width={520}
              height={56}
              activeColor="#FFFFFF"
              inactiveColor="rgba(255,255,255,0.35)"
              playbackProgress={1}
            />
          </div>
        )}

        <label className="upload-field">
          <span>Title</span>
          <input
            type="text"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My sample"
          />
        </label>

        <label className="upload-field">
          <span>Tags (comma separated)</span>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="lofi, drums, dusty"
          />
        </label>

        <div className="upload-field-row">
          <label className="upload-field">
            <span>BPM</span>
            <input
              type="number"
              min={1}
              value={bpm}
              onChange={(e) => setBpm(e.target.value)}
              placeholder="90"
            />
          </label>
          <label className="upload-field">
            <span>Key</span>
            <input
              type="text"
              value={musicalKey}
              maxLength={8}
              onChange={(e) => setMusicalKey(e.target.value)}
              placeholder="Am"
            />
          </label>
          <label className="upload-field">
            <span>Access</span>
            <select
              value={accessType}
              onChange={(e) =>
                setAccessType(e.target.value as "free" | "premium")
              }
            >
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>
          </label>
        </div>

        {error && <p className="upload-error">{error}</p>}

        <button
          type="submit"
          className="upload-btn"
          disabled={submitting || analyzing || !file}
        >
          {submitting ? "Uploading…" : "Upload as draft"}
        </button>
        <p className="upload-note">
          Uploaded as a private draft — publish it from your library when ready.
        </p>
      </form>
    </div>
  );
};

export default UploadPage;
