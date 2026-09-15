import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type { PublicUserDto, Sample } from "@retrosampled/shared";
import { ApiError } from "../../api/http";
import { fetchUser, fetchUserSamples, type ProfileTab } from "../../api/users";
import { useAuth } from "../../auth/useAuth";
import SamplePiece from "../../components/SamplePiece";
import { useInfiniteList } from "../../hooks/useInfiniteList";
import { useToast } from "../../hooks/useToast";
import ProfileHeader from "./ProfileHeader";
import ProfileTabs from "./ProfileTabs";
import "../social.css";
import "./ProfilePage.css";

type PageStatus = "loading" | "loaded" | "not-found" | "error";

const TABS: ProfileTab[] = ["uploads", "remakes", "liked"];

const parseTab = (value: string | null): ProfileTab =>
  value && (TABS as string[]).includes(value) ? (value as ProfileTab) : "uploads";

const EMPTY_COPY: Record<ProfileTab, string> = {
  uploads: "No uploads yet.",
  remakes: "No remakes yet.",
  liked: "No liked samples yet.",
};

const ProfilePage: React.FC = () => {
  const { username = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));
  // `isFollowing` / `isMe` depend on who is asking: refetch when the session changes.
  const { user: sessionUser, status: authStatus } = useAuth();
  const sessionUserId = sessionUser?.id ?? null;

  const [status, setStatus] = useState<PageStatus>("loading");
  const [user, setUser] = useState<PublicUserDto | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const { toast, showToast } = useToast();

  useEffect(() => {
    if (authStatus === "loading") return;
    let cancelled = false;
    setStatus("loading");
    setUser(null);

    fetchUser(username)
      .then((loaded) => {
        if (cancelled) return;
        setUser(loaded);
        setFollowersCount(loaded.stats.followers);
        setStatus("loaded");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus(error instanceof ApiError && error.status === 404 ? "not-found" : "error");
      });

    return () => {
      cancelled = true;
    };
  }, [username, sessionUserId, authStatus]);

  const loadPage = useCallback(
    (cursor?: string) =>
      fetchUserSamples(username, { tab, cursor, limit: 20 }).then((page) => ({
        items: page.samples,
        nextCursor: page.nextCursor,
      })),
    [tab, username]
  );

  const list = useInfiniteList<Sample>(loadPage, `${username}|${tab}`, {
    enabled: status === "loaded",
  });

  const changeTab = (next: ProfileTab) => {
    const params = new URLSearchParams(searchParams);
    if (next === "uploads") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  };

  if (status === "loading") {
    return (
      <main className="social-page" aria-busy="true">
        <div className="social-state">
          <p>Loading profile…</p>
        </div>
      </main>
    );
  }

  if (status === "not-found" || !user) {
    return (
      <main className="social-page">
        <div className="social-state">
          <p className="social-eyebrow">404</p>
          <h2>@{username} does not exist</h2>
          <p>The account may have been renamed or removed.</p>
          <Link to="/feed" className="social-btn">
            Back to feed
          </Link>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="social-page">
        <div className="social-state">
          <h2>Could not load this profile</h2>
          <button type="button" className="social-btn" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  const counts: Partial<Record<ProfileTab, number>> = {
    uploads: user.stats.uploads,
    remakes: user.stats.remakes,
  };

  return (
    <main className="social-page">
      <ProfileHeader
        user={user}
        followersCount={followersCount}
        onFollowChange={(state) => setFollowersCount(state.followersCount)}
        onFollowError={() => showToast("error", "Could not save follow. Changes reverted.")}
      />

      <ProfileTabs active={tab} counts={counts} onChange={changeTab} />

      <section className="profile-list" aria-label={`${tab} samples`}>
        {list.status === "loading" ? (
          <div className="social-state">
            <p>Loading samples…</p>
          </div>
        ) : list.status === "error" ? (
          <div className="social-state">
            <h2>Samples failed to load</h2>
            <p>{list.error}</p>
            <button type="button" className="social-btn" onClick={list.reload}>
              Retry
            </button>
          </div>
        ) : list.items.length === 0 ? (
          <div className="social-state">
            <h2>{EMPTY_COPY[tab]}</h2>
            {user.isMe && tab === "uploads" ? (
              <Link to="/upload" className="social-btn social-btn--primary">
                Upload a sample
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <div className="samples-container">
              {list.items.map((sample) => (
                <SamplePiece sample={sample} key={sample.id} />
              ))}
            </div>
            <div className="social-load-more" ref={list.sentinelRef}>
              {list.isLoadingMore ? "Loading more…" : list.hasMore ? "Scroll for more" : "End of list"}
            </div>
          </>
        )}
      </section>

      {toast ? (
        <div className={`page-toast page-toast--${toast.tone}`} role="status" aria-live="polite">
          {toast.text}
        </div>
      ) : null}
    </main>
  );
};

export default ProfilePage;
