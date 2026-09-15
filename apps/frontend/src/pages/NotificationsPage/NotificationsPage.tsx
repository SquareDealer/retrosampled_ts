import React, { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { NotificationDto } from "@retrosampled/shared";
import {
  emitUnreadChanged,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../api/notifications";
import { useInfiniteList } from "../../hooks/useInfiniteList";
import { formatTimeAgo } from "../../utils/formatTimeAgo";
import Avatar from "../ProfilePage/Avatar";
import "../social.css";
import "./NotificationsPage.css";

const describe = (notification: NotificationDto): React.ReactNode => {
  const actor = notification.actor ? <strong>@{notification.actor.username}</strong> : "Someone";
  const sample = notification.sample ? <strong>{notification.sample.title}</strong> : "your sample";

  switch (notification.type) {
    case "FOLLOW":
      return <>{actor} started following you</>;
    case "LIKE":
      return <>{actor} liked {sample}</>;
    case "COMMENT":
      return <>{actor} commented on {sample}</>;
    case "COMMENT_REPLY":
      return <>{actor} replied to your comment on {sample}</>;
    case "REMAKE":
      return <>{actor} made a remake of {sample}</>;
    case "SYSTEM":
    default:
      return <>Retrosampled update</>;
  }
};

const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [marking, setMarking] = useState(false);

  const loadPage = useCallback(
    (cursor?: string) =>
      fetchNotifications({ cursor, limit: 30 }).then((page) => {
        setUnreadCount(page.unreadCount);
        emitUnreadChanged(page.unreadCount);
        return { items: page.items, nextCursor: page.nextCursor };
      }),
    []
  );

  const list = useInfiniteList<NotificationDto>(loadPage, "notifications");

  const open = async (notification: NotificationDto) => {
    if (!notification.read) {
      list.setItems((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, read: true } : item))
      );
      try {
        const response = await markNotificationRead(notification.id);
        setUnreadCount(response.unreadCount);
        emitUnreadChanged(response.unreadCount);
      } catch {
        // Navigation still happens; the row will show as unread again on reload.
      }
    }
    navigate(notification.href);
  };

  const markAll = async () => {
    setMarking(true);
    try {
      const response = await markAllNotificationsRead();
      list.setItems((current) => current.map((item) => ({ ...item, read: true })));
      setUnreadCount(response.unreadCount);
      emitUnreadChanged(response.unreadCount);
    } finally {
      setMarking(false);
    }
  };

  return (
    <main className="social-page social-page--narrow">
      <p className="social-eyebrow">Activity</p>
      <h1 className="social-title">Notifications</h1>

      <div className="notifications-toolbar">
        <span>{unreadCount === null ? "" : `${unreadCount} unread`}</span>
        <button
          type="button"
          className="social-btn"
          onClick={() => void markAll()}
          disabled={marking || !unreadCount}
        >
          Mark all read
        </button>
      </div>

      {list.status === "loading" ? (
        <div className="social-state">
          <p>Loading…</p>
        </div>
      ) : list.status === "error" ? (
        <div className="social-state">
          <h2>Could not load notifications</h2>
          <p>{list.error}</p>
          <button type="button" className="social-btn" onClick={list.reload}>
            Retry
          </button>
        </div>
      ) : list.items.length === 0 ? (
        <div className="social-state">
          <h2>Nothing yet.</h2>
          <p>Follows, likes, comments and remakes on your samples will show up here.</p>
        </div>
      ) : (
        <>
          <ul className="notifications-list">
            {list.items.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  className={`notification-row${notification.read ? "" : " notification-row--unread"}`}
                  onClick={() => void open(notification)}
                >
                  <Avatar
                    src={notification.actor?.avatarUrl}
                    username={notification.actor?.username ?? "rs"}
                  />
                  <span className="notification-row__text">
                    <span>{describe(notification)}</span>
                    <span className="notification-row__time">
                      {formatTimeAgo(notification.createdAt)}
                    </span>
                  </span>
                  {notification.read ? <span /> : <span className="notification-row__dot" aria-label="Unread" />}
                </button>
              </li>
            ))}
          </ul>
          <div className="social-load-more" ref={list.sentinelRef}>
            {list.isLoadingMore ? "Loading more…" : list.hasMore ? "Scroll for more" : "That is everything"}
          </div>
        </>
      )}
    </main>
  );
};

export default NotificationsPage;
