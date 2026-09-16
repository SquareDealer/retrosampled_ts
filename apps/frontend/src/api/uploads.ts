/**
 * Upload endpoints. `uploadSample` / `uploadSampleAudio` use XMLHttpRequest so
 * the wizard can show byte-level progress; everything else goes through
 * `./http`.
 */
import type {
  CoverResponse,
  CreateSampleResponse,
  SampleDetail,
} from "@retrosampled/shared";
import * as engine from "../mocks/engine/samplesEngine";
import { API_URL, USE_MOCKS } from "./config";
import { ApiError, AUTH_EXPIRED_EVENT, postForm } from "./http";
import { createRemakeDraft } from "./samples";

export type UploadProgress = {
  loaded: number;
  total: number;
  /** 0..100 */
  percent: number;
};

export type UploadOptions = {
  signal?: AbortSignal;
};

/** Metadata fields the wizard sends alongside the audio file. */
export type SampleUploadFields = {
  title?: string;
  description?: string;
  bpm?: number | null;
  musicalKey?: string | null;
  sampleType?: string | null;
  tags?: string[];
  collaboratorIds?: string[];
  parentId?: string;
};

export const buildSampleFormData = (
  audio: File,
  fields: SampleUploadFields = {},
  cover?: File | null
): FormData => {
  const form = new FormData();
  form.append("audio", audio, audio.name);

  if (cover) {
    form.append("cover", cover, cover.name);
  }
  if (fields.title) form.append("title", fields.title);
  if (fields.description) form.append("description", fields.description);
  if (fields.bpm !== undefined && fields.bpm !== null) form.append("bpm", String(fields.bpm));
  if (fields.musicalKey) form.append("musicalKey", fields.musicalKey);
  if (fields.sampleType) form.append("sampleType", fields.sampleType);
  if (fields.parentId) form.append("parentId", fields.parentId);
  for (const tag of fields.tags ?? []) form.append("tags", tag);
  for (const id of fields.collaboratorIds ?? []) form.append("collaboratorIds", id);

  return form;
};

const parseXhrBody = (xhr: XMLHttpRequest): unknown => {
  const text = xhr.responseText;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const messageFrom = (body: unknown, status: number): string => {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message?: unknown }).message;
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;
  }
  return `Upload failed with status ${status}`;
};

const refreshSession = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    return response.ok;
  } catch {
    return false;
  }
};

const sendForm = <T>(
  path: string,
  form: FormData,
  onProgress?: (progress: UploadProgress) => void,
  options: UploadOptions = {}
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}${path}`);
    xhr.withCredentials = true;
    xhr.responseType = "text";

    xhr.upload.onprogress = (event) => {
      if (!onProgress) return;
      const total = event.lengthComputable ? event.total : 0;
      const percent = total > 0 ? Math.min(100, Math.round((event.loaded / total) * 100)) : 0;
      onProgress({ loaded: event.loaded, total, percent });
    };

    xhr.onload = () => {
      const body = parseXhrBody(xhr);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as T);
        return;
      }
      reject(new ApiError(xhr.status, messageFrom(body, xhr.status)));
    };
    xhr.onerror = () => reject(new ApiError(0, "Network error during upload"));
    xhr.onabort = () => reject(new ApiError(0, "Upload cancelled"));

    if (options.signal) {
      if (options.signal.aborted) {
        reject(new ApiError(0, "Upload cancelled"));
        return;
      }
      options.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(form);
  });

/** Same 401 → refresh → retry-once contract as `http.ts`. */
const sendFormWithRefresh = async <T>(
  path: string,
  form: FormData,
  onProgress?: (progress: UploadProgress) => void,
  options?: UploadOptions
): Promise<T> => {
  try {
    return await sendForm<T>(path, form, onProgress, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      if (await refreshSession()) {
        try {
          return await sendForm<T>(path, form, onProgress, options);
        } catch (retryError) {
          if (retryError instanceof ApiError && retryError.status === 401) {
            window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
          }
          throw retryError;
        }
      }
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    throw error;
  }
};

/** `POST /samples` — creates the draft (processing runs server-side) and returns it. */
export const uploadSample = async (
  form: FormData,
  onProgress?: (progress: UploadProgress) => void,
  options?: UploadOptions
): Promise<SampleDetail> => {
  if (USE_MOCKS) {
    for (const percent of [10, 45, 80, 100]) {
      await new Promise((resolve) => setTimeout(resolve, 120));
      onProgress?.({ loaded: percent, total: 100, percent });
    }
    return engine.mockUploadSample(form);
  }

  const response = await sendFormWithRefresh<CreateSampleResponse>(
    "/samples",
    form,
    onProgress,
    options
  );
  return response.sample;
};

/** `POST /samples/:id/audio` — attaches/replaces audio on an existing draft. */
export const uploadSampleAudio = async (
  sampleId: string,
  audio: File,
  onProgress?: (progress: UploadProgress) => void,
  options?: UploadOptions
): Promise<SampleDetail> => {
  const form = new FormData();
  form.append("audio", audio, audio.name);

  if (USE_MOCKS) {
    return engine.mockUpdateSample(sampleId, {});
  }

  const response = await sendFormWithRefresh<CreateSampleResponse>(
    `/samples/${encodeURIComponent(sampleId)}/audio`,
    form,
    onProgress,
    options
  );
  return response.sample;
};

export const uploadCover = async (sampleId: string, file: File): Promise<CoverResponse> => {
  if (USE_MOCKS) {
    return { coverUrl: URL.createObjectURL(file) };
  }

  const form = new FormData();
  form.append("file", file, file.name);
  return postForm<CoverResponse>(`/samples/${encodeURIComponent(sampleId)}/cover`, form);
};

/** `POST /samples/:id/remakes` — empty DRAFT child; alias of `createRemakeDraft`. */
export const createRemake = (parentId: string, title?: string): Promise<SampleDetail> =>
  createRemakeDraft(parentId, title);
