import type { UserRole } from '../enums';

/** Shape returned by `GET /auth/me` — the signed-in user of the current session. */
export type SessionUser = {
  sub: string;
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
};

export type MeResponse = {
  user: SessionUser;
};

export type PublicUserStats = {
  followers: number;
  following: number;
  uploads: number;
  remakes: number;
  likesReceived: number;
};

/** Shape returned by `GET /users/:username`. */
export type PublicUserDto = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  links: Record<string, string>;
  role: UserRole;
  createdAt: string;
  stats: PublicUserStats;
  isFollowing: boolean;
  isMe: boolean;
};

export type UpdateMeRequest = {
  username?: string;
  displayName?: string;
  bio?: string;
  links?: Record<string, string>;
};

/** Legacy `/profiles/*` payload kept as a thin alias while the UI migrates. */
export type ProfileResponse = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  links: Record<string, string>;
};

/** Compact user reference embedded in lists (followers, comments, notifications). */
export type UserRef = {
  id: string;
  username: string;
  avatarUrl?: string | null;
};
