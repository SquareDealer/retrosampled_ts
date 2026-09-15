/**
 * Samples API client. Thin HTTP layer over `./http`; with
 * `VITE_USE_MOCKS=true` every call delegates to the in-memory engine in
 * `src/mocks/engine/samplesEngine.ts`.
 */
import type {
  CoverResponse,
  CreateSampleResponse,
  DownloadResponse,
  LikeResponse,
  SampleDetail,
  SampleMetadataInput,
  SampleVisibility,
  SamplesListResponse,
  SamplesQuery,
} from "@retrosampled/shared";
import * as engine from "../mocks/engine/samplesEngine";
import { USE_MOCKS } from "./config";
import { ApiError, del, get, patch, post, put } from "./http";

export type SamplesSort = "newest" | "popular" | "liked" | "remakes";

/**
 * @deprecated The platform is free; the `type` filter is ignored by the API
 * and only kept so `FeedPage` compiles until Task 3.2 removes it.
 */
export type SamplesAccessType = "free" | "premium";

export type FetchSamplesQuery = SamplesQuery & {
  /** @deprecated ignored */
  type?: SamplesAccessType;
};

export type FetchSamplesResponse = SamplesListResponse;

const appendParam = (params: URLSearchParams, key: string, value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return;
  }

  params.set(key, String(value));
};

export const buildSamplesSearchParams = (query: FetchSamplesQuery): URLSearchParams => {
  const params = new URLSearchParams();

  appendParam(params, "search", query.search?.trim());
  appendParam(params, "bpm_min", query.bpm_min);
  appendParam(params, "bpm_max", query.bpm_max);
  appendParam(params, "key", query.key);
  appendParam(params, "sort", query.sort ?? "newest");
  appendParam(params, "cursor", query.cursor);
  appendParam(params, "limit", query.limit ?? 20);
  appendParam(params, "author", query.author);
  appendParam(params, "tab", query.tab);

  for (const tag of query.tags ?? []) {
    if (tag) {
      params.append("tags", tag);
    }
  }

  return params;
};

export const fetchSamples = async (query: FetchSamplesQuery): Promise<FetchSamplesResponse> => {
  if (USE_MOCKS) {
    return engine.fetchMockSamples(query);
  }

  const response = await get<Partial<FetchSamplesResponse>>(
    `/samples?${buildSamplesSearchParams(query).toString()}`
  );

  return {
    samples: response.samples ?? [],
    nextCursor: response.nextCursor ?? undefined,
  };
};

/** `null` when the sample does not exist or is hidden from the viewer (404). */
export const fetchSampleById = async (
  sampleId: string,
  options?: { delayMs?: number }
): Promise<SampleDetail | null> => {
  if (USE_MOCKS) {
    return engine.fetchMockDraft(sampleId) ?? engine.fetchMockSampleById(sampleId, options);
  }

  if (!sampleId) {
    return null;
  }

  try {
    return await get<SampleDetail>(`/samples/${encodeURIComponent(sampleId)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
};

export const toggleLike = async (sampleId: string, nextLiked: boolean): Promise<LikeResponse> => {
  if (USE_MOCKS) {
    return engine.mockToggleLike(sampleId, nextLiked);
  }

  const path = `/samples/${encodeURIComponent(sampleId)}/like`;
  return nextLiked ? put<LikeResponse>(path) : del<LikeResponse>(path);
};

export const createRemakeDraft = async (parentId: string, title?: string): Promise<SampleDetail> => {
  if (USE_MOCKS) {
    return engine.mockCreateRemakeDraft(parentId, title);
  }

  const response = await post<CreateSampleResponse>(
    `/samples/${encodeURIComponent(parentId)}/remakes`,
    title ? { title } : {}
  );
  return response.sample;
};

export const updateSample = async (
  sampleId: string,
  input: SampleMetadataInput
): Promise<SampleDetail> => {
  if (USE_MOCKS) {
    return engine.mockUpdateSample(sampleId, input);
  }

  const response = await patch<CreateSampleResponse>(
    `/samples/${encodeURIComponent(sampleId)}`,
    input
  );
  return response.sample;
};

export const setVisibility = async (
  sampleId: string,
  status: SampleVisibility
): Promise<SampleDetail> => {
  if (USE_MOCKS) {
    return engine.mockSetVisibility(sampleId, status);
  }

  const response = await patch<CreateSampleResponse>(
    `/samples/${encodeURIComponent(sampleId)}/visibility`,
    { status }
  );
  return response.sample;
};

export const deleteSample = async (sampleId: string): Promise<void> => {
  if (USE_MOCKS) {
    return engine.mockDeleteSample(sampleId);
  }

  await del<void>(`/samples/${encodeURIComponent(sampleId)}`);
};

export const retryProcessing = async (sampleId: string): Promise<SampleDetail> => {
  if (USE_MOCKS) {
    return engine.mockSetVisibility(sampleId, "private");
  }

  const response = await post<CreateSampleResponse>(
    `/samples/${encodeURIComponent(sampleId)}/retry-processing`
  );
  return response.sample;
};

export const requestDownload = async (sampleId: string): Promise<DownloadResponse> => {
  if (USE_MOCKS) {
    return engine.mockRequestDownload(sampleId);
  }

  return post<DownloadResponse>(`/samples/${encodeURIComponent(sampleId)}/downloads`);
};

/** Fire-and-forget; a failed play report must never surface to the user. */
export const reportPlay = async (sampleId: string): Promise<void> => {
  if (USE_MOCKS || !sampleId) {
    return;
  }

  try {
    await post<void>(`/samples/${encodeURIComponent(sampleId)}/plays`, undefined, {
      skipAuthRefresh: true,
    });
  } catch {
    // ignore
  }
};

export type { CoverResponse };
