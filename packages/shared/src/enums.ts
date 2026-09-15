/**
 * Enum-ish unions shared by the backend (SQLite stores them as plain strings)
 * and the frontend. Declared as `as const` arrays so they double as runtime
 * value lists (validation, `<select>` options) and as literal union types.
 */

export const USER_ROLES = ['USER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

export const SAMPLE_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'PRIVATE',
  'PROCESSING',
  'FAILED',
] as const;
export type SampleStatus = (typeof SAMPLE_STATUSES)[number];

export function isSampleStatus(value: unknown): value is SampleStatus {
  return (
    typeof value === 'string' && (SAMPLE_STATUSES as readonly string[]).includes(value)
  );
}

export const CREATOR_ROLES = [
  'OG_CREATOR',
  'INHERITED_OG_CREATOR',
  'CURRENT_CREATOR',
  'COLLABORATOR',
] as const;
export type CreatorRole = (typeof CREATOR_ROLES)[number];

/** Display order for a creator holding several attribution roles. */
export const CREATOR_ROLE_PRIORITY: CreatorRole[] = [
  'OG_CREATOR',
  'INHERITED_OG_CREATOR',
  'CURRENT_CREATOR',
  'COLLABORATOR',
];

export function isCreatorRole(value: unknown): value is CreatorRole {
  return (
    typeof value === 'string' && (CREATOR_ROLES as readonly string[]).includes(value)
  );
}

export const NOTIFICATION_TYPES = [
  'FOLLOW',
  'LIKE',
  'COMMENT',
  'COMMENT_REPLY',
  'REMAKE',
  'SYSTEM',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export function isNotificationType(value: unknown): value is NotificationType {
  return (
    typeof value === 'string' &&
    (NOTIFICATION_TYPES as readonly string[]).includes(value)
  );
}

export const LIBRARY_TABS = ['liked', 'downloaded', 'uploads', 'remakes'] as const;
export type LibraryTab = (typeof LIBRARY_TABS)[number];

export function isLibraryTab(value: unknown): value is LibraryTab {
  return typeof value === 'string' && (LIBRARY_TABS as readonly string[]).includes(value);
}

export const LIBRARY_STATUSES = [
  'draft',
  'published',
  'private',
  'processing',
  'failed',
] as const;
export type LibraryStatus = (typeof LIBRARY_STATUSES)[number];

export function isLibraryStatus(value: unknown): value is LibraryStatus {
  return (
    typeof value === 'string' && (LIBRARY_STATUSES as readonly string[]).includes(value)
  );
}

export const SAMPLES_SORTS = ['newest', 'popular', 'liked', 'remakes'] as const;
export type SamplesSort = (typeof SAMPLES_SORTS)[number];

export function isSamplesSort(value: unknown): value is SamplesSort {
  return (
    typeof value === 'string' && (SAMPLES_SORTS as readonly string[]).includes(value)
  );
}
