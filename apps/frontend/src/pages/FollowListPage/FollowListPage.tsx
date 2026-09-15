import React, { useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import type { UserListItem } from "@retrosampled/shared";
import { fetchFollowers, fetchFollowing } from "../../api/users";
import { useInfiniteList } from "../../hooks/useInfiniteList";
import { useToast } from "../../hooks/useToast";
import { formatCompactNumber } from "../../utils/formatCompactNumber";
import Avatar from "../ProfilePage/Avatar";
import FollowButton from "../ProfilePage/FollowButton";
import "../social.css";
import "./FollowListPage.css";

export type FollowListMode = "followers" | "following";

type FollowListPageProps = {
  mode: FollowListMode;
};

const FollowRow: React.FC<{ user: UserListItem; onError: () => void }> = ({ user, onError }) => (
  <li className="follow-row">
    <Link to={`/user/${user.username}`} aria-label={`Open @${user.username}`}>
      <Avatar src={user.avatarUrl} username={user.username} />
    </Link>
    <div className="follow-row__main">
      <Link to={`/user/${user.username}`} className="follow-row__name">
        {user.displayName || `@${user.username}`}
      </Link>
      <span className="follow-row__meta">
        @{user.username} · {formatCompactNumber(user.followersCount)} followers
      </span>
    </div>
    <FollowButton
      userId={user.id}
      username={user.username}
      initialFollowing={user.isFollowing}
      initialFollowersCount={user.followersCount}
      onError={onError}
    />
  </li>
);

const FollowListPage: React.FC<FollowListPageProps> = ({ mode }) => {
  const { username = "" } = useParams();
  const { toast, showToast } = useToast();

  const loadPage = useCallback(
    (cursor?: string) =>
      (mode === "followers" ? fetchFollowers : fetchFollowing)(username, cursor, 30).then((page) => ({
        items: page.users,
        nextCursor: page.nextCursor,
      })),
    [mode, username]
  );

  const list = useInfiniteList<UserListItem>(loadPage, `${username}|${mode}`);
  const title = mode === "followers" ? "Followers" : "Following";
  const onError = () => showToast("error", "Could not save follow. Changes reverted.");

  return (
    <main className="social-page social-page--narrow">
      <p className="social-eyebrow">
        <Link to={`/user/${username}`} className="profile-links__item">
          @{username}
        </Link>
      </p>
      <h1 className="social-title">{title}</h1>

      <nav className="follow-list__nav" aria-label="Follow lists">
        <Link to={`/user/${username}/followers`} aria-current={mode === "followers" ? "page" : undefined}>
          Followers
        </Link>
        <Link to={`/user/${username}/following`} aria-current={mode === "following" ? "page" : undefined}>
          Following
        </Link>
      </nav>

      {list.status === "loading" ? (
        <div className="social-state" style={{ marginTop: 24 }}>
          <p>Loading…</p>
        </div>
      ) : list.status === "error" ? (
        <div className="social-state" style={{ marginTop: 24 }}>
          <h2>Could not load the list</h2>
          <p>{list.error}</p>
          <button type="button" className="social-btn" onClick={list.reload}>
            Retry
          </button>
        </div>
      ) : list.items.length === 0 ? (
        <div className="social-state" style={{ marginTop: 24 }}>
          <h2>{mode === "followers" ? "No followers yet." : "Not following anyone yet."}</h2>
        </div>
      ) : (
        <>
          <ul className="follow-list">
            {list.items.map((user) => (
              <FollowRow key={user.id} user={user} onError={onError} />
            ))}
          </ul>
          <div className="social-load-more" ref={list.sentinelRef}>
            {list.isLoadingMore ? "Loading more…" : list.hasMore ? "Scroll for more" : "End of list"}
          </div>
        </>
      )}

      {toast ? (
        <div className={`page-toast page-toast--${toast.tone}`} role="status" aria-live="polite">
          {toast.text}
        </div>
      ) : null}
    </main>
  );
};

export default FollowListPage;
