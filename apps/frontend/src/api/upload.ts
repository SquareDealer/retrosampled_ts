import { WaveformPeaks } from "../utils/analyzeAudioFile";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export type UploadSampleInput = {
  file: File;
  title: string;
  tags: string[];
  bpm?: number;
  key?: string;
  accessType: "free" | "premium";
  durationSec: number;
  peaks: WaveformPeaks;
  parentId?: string;
};

export type UploadSampleResult = {
  id: string;
  title: string;
  status: string;
};

export async function uploadSample(
  input: UploadSampleInput
): Promise<UploadSampleResult> {
  const form = new FormData();
  form.append("audio", input.file);
  form.append("title", input.title);
  if (input.tags.length) form.append("tags", input.tags.join(","));
  if (input.bpm) form.append("bpm", String(input.bpm));
  if (input.key) form.append("key", input.key);
  form.append("accessType", input.accessType);
  form.append("durationSec", String(input.durationSec));
  form.append("peaks", JSON.stringify(input.peaks));
  if (input.parentId) form.append("parentId", input.parentId);

  const response = await fetch(`${API_URL}/samples`, {
    method: "POST",
    credentials: "include",
    body: form,
  });

  if (response.status === 401) {
    throw new Error("Please sign in to upload a sample.");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message;
    throw new Error(message || "Upload failed. Please try again.");
  }

  return (await response.json()) as UploadSampleResult;
}
