import type {
  ContinueWorkingItem,
  ContinueWorkingResponse,
  LibraryQuery,
  LibraryResponse,
} from "@retrosampled/shared";
import { USE_MOCKS } from "./config";
import { del, get, post, put } from "./http";
import { mockContinueWorkingItems, mockLibraryItems } from "../mocks/engine/libraryEngine";

export type LikeResponse = { liked: boolean; likesCount: number };
export type DownloadResponse = {
  downloadUrl: string;
  expiresAt?: string;
  downloadsCount?: number;
};

export const getLibraryItems = (query: LibraryQuery): Promise<LibraryResponse> => {
  if (USE_MOCKS) return mockLibraryItems(query);

  const params = new URLSearchParams();
  params.set("tab", query.tab);
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.sort) params.set("sort", query.sort);
  if (query.status) params.set("status", query.status);
  if (query.cursor) params.set("cursor", query.cursor);
  params.set("limit", String(query.limit ?? 20));

  return get<LibraryResponse>(`/library/items?${params.toString()}`);
};

export const getContinueWorkingItems = async (): Promise<ContinueWorkingItem[]> => {
  if (USE_MOCKS) return mockContinueWorkingItems();

  const response = await get<ContinueWorkingResponse>("/library/continue-working");
  return response.items;
};

// The sample action endpoints (Task 3.1a) are called directly here so this
// file never has to import `api/samples.ts`.

export const likeSample = (sampleId: string) =>
  put<LikeResponse>(`/samples/${encodeURIComponent(sampleId)}/like`);

export const unlikeSample = (sampleId: string) =>
  del<LikeResponse>(`/samples/${encodeURIComponent(sampleId)}/like`);

export const requestDownload = (sampleId: string) =>
  post<DownloadResponse>(`/samples/${encodeURIComponent(sampleId)}/downloads`);
