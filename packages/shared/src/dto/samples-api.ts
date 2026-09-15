import type { SamplesSort } from '../enums';
import type { Sample, SampleDetail } from './sample';

/** `sampleType` values accepted by the upload wizard and the API. */
export const SAMPLE_TYPES = ['loop', 'chop', 'one-shot'] as const;
export type SampleType = (typeof SAMPLE_TYPES)[number];

export function isSampleType(value: unknown): value is SampleType {
  return typeof value === 'string' && (SAMPLE_TYPES as readonly string[]).includes(value);
}

/** Visibility values accepted by `PATCH /samples/:id/visibility`. */
export const SAMPLE_VISIBILITIES = ['published', 'private'] as const;
export type SampleVisibility = (typeof SAMPLE_VISIBILITIES)[number];

/** Profile tabs served by `GET /samples?author=<username>&tab=<tab>`. */
export const SAMPLES_AUTHOR_TABS = ['uploads', 'remakes', 'liked'] as const;
export type SamplesAuthorTab = (typeof SAMPLES_AUTHOR_TABS)[number];

/** Query string of `GET /samples`. Arrays are sent as repeated or comma-joined params. */
export type SamplesQuery = {
  search?: string;
  tags?: string[];
  bpm_min?: number;
  bpm_max?: number;
  key?: string;
  sort?: SamplesSort;
  cursor?: string;
  limit?: number;
  /** Username: restrict to one author (public profile tabs). */
  author?: string;
  /** Only meaningful together with `author`. */
  tab?: SamplesAuthorTab;
};

export type SamplesListResponse = {
  samples: Sample[];
  nextCursor?: string;
};

/** Metadata accepted by `POST /samples` (multipart) and `PATCH /samples/:id` (JSON). */
export type SampleMetadataInput = {
  title?: string;
  description?: string | null;
  bpm?: number | null;
  musicalKey?: string | null;
  sampleType?: SampleType | null;
  tags?: string[];
  collaboratorIds?: string[];
};

export type CreateSampleResponse = {
  sample: SampleDetail;
};

export type LikeResponse = {
  liked: boolean;
  likesCount: number;
};

export type DownloadResponse = {
  downloadUrl: string;
  expiresAt: string;
  downloadsCount: number;
};

export type CoverResponse = {
  coverUrl: string;
};

export type SetVisibilityRequest = {
  status: SampleVisibility;
};

export type CreateRemakeRequest = {
  title?: string;
};

/**
 * The exact JSON shape written to `samples/{id}/peaks.json`, compatible with
 * the audiowaveform v2 format that `WaveformFromJsonForSample` consumes:
 * `data` holds interleaved `[min, max, min, max, ...]` pairs.
 */
export type PeaksJson = {
  version: 2;
  channels: number;
  sample_rate: number;
  samples_per_pixel: number;
  bits: 8 | 16;
  length: number;
  data: number[];
};
