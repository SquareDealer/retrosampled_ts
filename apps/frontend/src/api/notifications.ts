import type { NotificationsResponse, UnreadCountResponse } from "@retrosampled/shared";
import { get, patch } from "./http";

export type NotificationsQuery = {
  cursor?: string;
  limit?: number;
  unreadOnly?: boolean;
};

export const fetchNotifications = (query: NotificationsQuery = {}) => {
  const params = new URLSearchParams();
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit) params.set("limit", String(query.limit));
  if (query.unreadOnly) params.set("unreadOnly", "true");
  const suffix = params.toString();
  return get<NotificationsResponse>(`/notifications${suffix ? `?${suffix}` : ""}`);
};

export const fetchUnreadCount = () => get<UnreadCountResponse>("/notifications/unread-count");

export const markNotificationRead = (id: string) =>
  patch<UnreadCountResponse>(`/notifications/${encodeURIComponent(id)}/read`);

export const markAllNotificationsRead = () =>
  patch<UnreadCountResponse>("/notifications/read-all");

/** Fired whenever the unread count changes locally so the header badge updates at once. */
export const UNREAD_CHANGED_EVENT = "retrosampled:unread-changed";

export const emitUnreadChanged = (unreadCount: number) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(UNREAD_CHANGED_EVENT, { detail: { unreadCount } }));
};
