import type { SampleComment } from './sample';
import type { UserRef } from './user';

/** `POST` / `DELETE /users/:id/follow`. */
export type FollowResponse = {
  following: boolean;
  followersCount: number;
};

/** Row of `GET /users/:username/followers|following` and `GET /users/search`. */
export type UserListItem = UserRef & {
  displayName: string | null;
  followersCount: number;
  isFollowing: boolean;
};

export type UsersListResponse = {
  users: UserListItem[];
  nextCursor: string | null;
};

export type UserSearchResponse = {
  users: UserListItem[];
};

export type AvatarResponse = {
  avatarUrl: string | null;
};

/** `GET /samples/:id/comments` — a page of top-level comments with their replies. */
export type CommentsPageResponse = {
  totalCount: number;
  comments: SampleComment[];
  nextCursor: string | null;
};

export type CreateCommentRequest = {
  text: string;
  parentId?: string;
};

export type UpdateCommentRequest = {
  text: string;
};

export type ContinueWorkingResponse = {
  items: import('./library').ContinueWorkingItem[];
};

export type SearchType = 'all' | 'samples' | 'users' | 'tags';

export type SearchSampleHit = {
  id: string;
  title: string;
  owner: UserRef;
  bpm: number | null;
  key: string | null;
};

export type SearchTagHit = {
  name: string;
  usageCount: number;
};

/** `GET /search?q&type&limit`. */
export type SearchResponse = {
  query: string;
  samples: SearchSampleHit[];
  users: UserListItem[];
  tags: SearchTagHit[];
};
