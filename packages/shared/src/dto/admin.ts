import type { SampleStatus, UserRole } from '../enums';

/** Row shape of `GET /admin/users`. */
export type AdminUserDto = {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
};

export type AdminUsersResponse = {
  users: AdminUserDto[];
  /** Pass back as `?cursor=` to fetch the next page; `null` on the last page. */
  nextCursor: string | null;
};

export type AdminUsersQuery = {
  cursor?: string;
  limit?: number;
  /** Case-insensitive substring match on email / username / display name. */
  q?: string;
};

export type UpdateAdminUserRequest = {
  role?: UserRole;
  isActive?: boolean;
};

/** The two visibility states an admin may force a sample into. */
export type AdminVisibility = 'published' | 'private';

export type UpdateSampleVisibilityRequest = {
  status: AdminVisibility;
};

export type AdminSampleDto = {
  id: string;
  ownerId: string;
  title: string;
  status: SampleStatus;
  publishedAt: string | null;
};
