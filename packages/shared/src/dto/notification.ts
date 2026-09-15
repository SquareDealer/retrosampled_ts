import type { NotificationType } from '../enums';
import type { UserRef } from './user';

export type NotificationSampleRef = {
  id: string;
  title: string;
};

export type NotificationDto = {
  id: string;
  type: NotificationType;
  actor: UserRef | null;
  sample: NotificationSampleRef | null;
  commentId?: string | null;
  read: boolean;
  createdAt: string;
  /** Where the UI should navigate when the notification is clicked. */
  href: string;
};

export type NotificationsResponse = {
  items: NotificationDto[];
  unreadCount: number;
  nextCursor: string | null;
};

export type UnreadCountResponse = {
  unreadCount: number;
};
