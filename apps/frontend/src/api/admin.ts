import type {
  AdminSampleDto,
  AdminUsersQuery,
  AdminUsersResponse,
  AdminUserDto,
  AdminVisibility,
  UpdateAdminUserRequest,
} from "@retrosampled/shared";
import { del, get, patch } from "./http";

function toQueryString(query: AdminUsersQuery): string {
  const params = new URLSearchParams();

  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.q) params.set("q", query.q);

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

/** `GET /admin/users` — one page of accounts, newest first. */
export const fetchUsers = (query: AdminUsersQuery = {}) =>
  get<AdminUsersResponse>(`/admin/users${toQueryString(query)}`);

/** `PATCH /admin/users/:id` — change a role or (de)activate an account. */
export const updateUser = (id: string, body: UpdateAdminUserRequest) =>
  patch<AdminUserDto>(`/admin/users/${id}`, body);

/** `DELETE /admin/samples/:id` — removes the row; remakes become new roots. */
export const deleteSample = (id: string) => del<void>(`/admin/samples/${id}`);

/** `PATCH /admin/samples/:id/visibility` */
export const setSampleVisibility = (id: string, status: AdminVisibility) =>
  patch<AdminSampleDto>(`/admin/samples/${id}/visibility`, { status });

/** `DELETE /admin/comments/:id` — soft delete. */
export const deleteComment = (id: string) => del<void>(`/admin/comments/${id}`);
