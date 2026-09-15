import type { FollowResponse } from "@retrosampled/shared";
import { del, post } from "./http";

export const followUser = (userId: string) =>
  post<FollowResponse>(`/users/${encodeURIComponent(userId)}/follow`);

export const unfollowUser = (userId: string) =>
  del<FollowResponse>(`/users/${encodeURIComponent(userId)}/follow`);

export const setFollowing = (userId: string, following: boolean) =>
  following ? followUser(userId) : unfollowUser(userId);
