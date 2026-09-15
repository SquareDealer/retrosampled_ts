import type {
  AvatarResponse,
  MessageResponse,
  PublicUserDto,
  Sample,
  UpdateMeRequest,
  UserSearchResponse,
  UsersListResponse,
} from "@retrosampled/shared";
import { API_URL } from "./config";
import { ApiError, del, get, patch, postForm } from "./http";

export type ProfileTab = "uploads" | "remakes" | "liked";

export type ProfileSamplesQuery = {
  tab: ProfileTab;
  sort?: string;
  cursor?: string;
  limit?: number;
};

export type ProfileSamplesResponse = {
  samples: Sample[];
  nextCursor?: string | null;
};

/**
 * `avatarUrl` may arrive as a full URL (users endpoints) or as a raw storage
 * key (`/auth/me`, until the auth service is unified with the storage helper).
 * Both render correctly through this.
 */
export function resolveAvatarUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith("/") || value.startsWith("data:")) {
    return value;
  }
  return `${API_URL}/uploads/${value}`;
}

const encode = encodeURIComponent;

export const fetchUser = (username: string) =>
  get<PublicUserDto>(`/users/${encode(username)}`);

export const updateMe = (dto: UpdateMeRequest) => patch<PublicUserDto>("/users/me", dto);

export const uploadAvatar = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return postForm<AvatarResponse>("/users/me/avatar", form);
};

export const removeAvatar = () => del<AvatarResponse>("/users/me/avatar");

export const deleteAccount = (password: string) =>
  del<MessageResponse>("/auth/account", { password });

export const searchUsers = (q: string, limit = 10) =>
  get<UserSearchResponse>(`/users/search?q=${encode(q)}&limit=${limit}`);

const listParams = (cursor?: string, limit?: number) => {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (limit) params.set("limit", String(limit));
  const query = params.toString();
  return query ? `?${query}` : "";
};

export const fetchFollowers = (username: string, cursor?: string, limit?: number) =>
  get<UsersListResponse>(`/users/${encode(username)}/followers${listParams(cursor, limit)}`);

export const fetchFollowing = (username: string, cursor?: string, limit?: number) =>
  get<UsersListResponse>(`/users/${encode(username)}/following${listParams(cursor, limit)}`);

/**
 * Profile tabs reuse the feed endpoint: `GET /samples?author=&tab=` (Task 3.1a).
 * Until that endpoint exists a 404 is treated as "no samples" so the profile
 * still renders its empty states.
 */
export async function fetchUserSamples(
  username: string,
  query: ProfileSamplesQuery
): Promise<ProfileSamplesResponse> {
  const params = new URLSearchParams();
  params.set("author", username);
  params.set("tab", query.tab);
  if (query.sort) params.set("sort", query.sort);
  if (query.cursor) params.set("cursor", query.cursor);
  params.set("limit", String(query.limit ?? 20));

  try {
    const response = await get<Partial<ProfileSamplesResponse>>(`/samples?${params.toString()}`);
    return { samples: response.samples ?? [], nextCursor: response.nextCursor ?? null };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { samples: [], nextCursor: null };
    }
    throw error;
  }
}
