import type { SampleDetail, SampleType } from "@retrosampled/shared";
import type { Sample } from "../../types/Sample";

export const MAX_UPLOAD_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB) > 0
  ? Number(import.meta.env.VITE_MAX_UPLOAD_MB)
  : 50;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
export const COVER_MAX_BYTES = 2 * 1024 * 1024;

export const AUDIO_EXTENSIONS = ["wav", "mp3", "flac", "aiff", "aif"];
export const COVER_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

export const KEY_OPTIONS = [
  "C", "Cm", "C#", "C#m", "Db", "Dbm", "D", "Dm", "D#", "D#m", "Eb", "Ebm", "E", "Em",
  "F", "Fm", "F#", "F#m", "Gb", "Gbm", "G", "Gm", "G#", "G#m", "Ab", "Abm", "A", "Am",
  "A#", "A#m", "Bb", "Bbm", "B", "Bm",
];

export const SAMPLE_TYPE_OPTIONS: Array<{ value: SampleType; label: string }> = [
  { value: "loop", label: "loop" },
  { value: "chop", label: "chop" },
  { value: "one-shot", label: "one-shot" },
];

export const TITLE_MAX_LENGTH = 80;
export const MAX_TAGS = 8;

export const STEP_LABELS = ["file", "details", "processing", "publish"] as const;

export const extensionOf = (name: string): string => {
  const index = name.lastIndexOf(".");
  return index === -1 ? "" : name.slice(index + 1).toLowerCase();
};

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} kb`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} mb`;
};

export const formatSeconds = (totalSeconds?: number | null): string => {
  const safe = Math.max(0, Math.floor(totalSeconds ?? 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
};

/** Validation error for a candidate audio file, or null when acceptable. */
export const validateAudioFile = (file: File): string | null => {
  const extension = extensionOf(file.name);
  const problems: string[] = [];

  if (!AUDIO_EXTENSIONS.includes(extension)) {
    problems.push(`${extension || "that format"} isn't supported`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    problems.push(`the file is over ${MAX_UPLOAD_MB} mb`);
  }

  if (problems.length === 0) {
    return null;
  }

  return `${problems.join(" and ")}. export as wav, mp3, flac or aiff and try again.`;
};

export const validateCoverFile = (file: File): string | null => {
  if (!COVER_EXTENSIONS.includes(extensionOf(file.name))) {
    return "cover must be a png, jpg or webp image.";
  }
  if (file.size > COVER_MAX_BYTES) {
    return "cover must be under 2 mb.";
  }
  return null;
};

/** `SampleDetail` → the row shape `SamplePiece` renders (parent card on remakes). */
export const toRowSample = (detail: SampleDetail): Sample => ({
  id: detail.id,
  authorId: detail.ownerId ?? detail.authors[0]?.id ?? "",
  author: detail.authors[0]?.name ?? (detail.ownerUsername ? `@${detail.ownerUsername}` : ""),
  collaboratorIds: detail.collaboratorIds,
  title: detail.title,
  tags: detail.tags,
  audioUrl: detail.audioPreviewUrl,
  time: formatSeconds(detail.duration),
  key: detail.musicalKey,
  bpm: detail.bpm,
  type: detail.sampleType ?? undefined,
  likesCount: detail.likesCount,
  isLiked: detail.isLiked,
  remakesCount: detail.remakesCount,
  jsonPeaksUrl: detail.waveformPeaksUrl,
  status: detail.status,
  coverUrl: detail.coverUrl,
});
