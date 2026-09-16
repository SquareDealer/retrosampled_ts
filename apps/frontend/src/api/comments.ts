import type {
  CommentsPageResponse,
  CommentsSortOption,
  SampleComment,
} from "@retrosampled/shared";
import { del, get, patch, post } from "./http";

export type CommentsQuery = {
  sort?: CommentsSortOption;
  cursor?: string;
  limit?: number;
};

export const fetchComments = (sampleId: string, query: CommentsQuery = {}) => {
  const params = new URLSearchParams();
  if (query.sort) params.set("sort", query.sort);
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit) params.set("limit", String(query.limit));
  const suffix = params.toString();
  return get<CommentsPageResponse>(
    `/samples/${encodeURIComponent(sampleId)}/comments${suffix ? `?${suffix}` : ""}`
  );
};

export const createComment = (sampleId: string, text: string, parentId?: string) =>
  post<SampleComment>(
    `/samples/${encodeURIComponent(sampleId)}/comments`,
    parentId ? { text, parentId } : { text }
  );

export const updateComment = (commentId: string, text: string) =>
  patch<SampleComment>(`/comments/${encodeURIComponent(commentId)}`, { text });

export const deleteComment = (commentId: string) =>
  del<void>(`/comments/${encodeURIComponent(commentId)}`);
