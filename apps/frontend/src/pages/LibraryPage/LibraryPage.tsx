import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type {
  ContinueWorkingItem,
  LibraryItem,
  LibraryStatus,
  LibraryTab,
  Sample,
} from "@retrosampled/shared";
import { isLibraryStatus, isLibraryTab } from "@retrosampled/shared";
import {
  getContinueWorkingItems,
  getLibraryItems,
  likeSample,
  requestDownload,
  unlikeSample,
} from "../../api/library";
import { useAuth } from "../../auth/useAuth";
import { useAudioContextManager } from "../../components/useAudioContextManager";
import { WaveformFromJsonForSample } from "../../components/waveform/WaveformFromJsonForSample";
import { useInfiniteList } from "../../hooks/useInfiniteList";
import { useToast } from "../../hooks/useToast";
import "../social.css";
import "./LibraryPage.css";

type SortOption = { value: string; label: string };
type FilterOption = { value: string; label: string };

const tabs: { key: LibraryTab; label: string }[] = [
  { key: "liked", label: "Liked" },
  { key: "downloaded", label: "Downloaded" },
  { key: "uploads", label: "My uploads" },
  { key: "remakes", label: "My remakes" },
];

const sortOptions: Record<LibraryTab, SortOption[]> = {
  liked: [
    { value: "recently-liked", label: "Recently liked" },
    { value: "most-popular", label: "Most popular" },
    { value: "newest", label: "Newest" },
  ],
  downloaded: [
    { value: "recently-downloaded", label: "Recently downloaded" },
    { value: "newest", label: "Newest" },
    { value: "most-popular", label: "Most popular" },
  ],
  uploads: [
    { value: "newest", label: "Newest" },
    { value: "most-played", label: "Most played" },
    { value: "most-liked", label: "Most liked" },
  ],
  remakes: [
    { value: "newest", label: "Newest" },
    { value: "most-liked", label: "Most liked" },
    { value: "original-popularity", label: "Original popularity" },
  ],
};

const statusFilters: FilterOption[] = [
  { value: "", label: "All" },
  { value: "published", label: "Published" },
  { value: "private", label: "Private" },
  { value: "draft", label: "Drafts" },
  { value: "processing", label: "Processing" },
  { value: "failed", label: "Failed" },
];

const remakeStatusFilters: FilterOption[] = statusFilters.filter(
  (option) => option.value !== "processing" && option.value !== "failed"
);

const emptyStates: Record<LibraryTab, { title: string; body: string; action: string; href: string }> = {
  liked: {
    title: "You haven't liked anything yet.",
    body: "Explore samples and save your favorites here.",
    action: "Go to Feed",
    href: "/feed",
  },
  downloaded: {
    title: "No downloads yet.",
    body: "Downloaded samples will appear here.",
    action: "Explore samples",
    href: "/feed",
  },
  uploads: {
    title: "You haven't uploaded anything yet.",
    body: "Upload your first sample and start building your catalog.",
    action: "Upload sample",
    href: "/upload",
  },
  remakes: {
    title: "No remakes yet.",
    body: "Find a sample and create your own version.",
    action: "Explore samples",
    href: "/feed",
  },
};

type UrlState = {
  tab: LibraryTab;
  search: string;
  sort: string;
  status: LibraryStatus | "";
};

const readUrlState = (params: URLSearchParams): UrlState => {
  const requestedTab = params.get("tab");
  const tab: LibraryTab = isLibraryTab(requestedTab) ? requestedTab : "liked";
  const requestedStatus = params.get("status");
  const requestedSort = params.get("sort") ?? "";
  const sort = sortOptions[tab].some((option) => option.value === requestedSort)
    ? requestedSort
    : sortOptions[tab][0].value;

  return {
    tab,
    search: params.get("search") ?? "",
    sort,
    status: isLibraryStatus(requestedStatus) ? requestedStatus : "",
  };
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
};

const toSample = (item: LibraryItem): Sample => ({
  id: item.id,
  authorId: item.creator.id,
  author: item.creator.username,
  title: item.title,
  tags: item.tags,
  audioUrl: item.audioPreviewUrl ?? "",
  time: formatDuration(item.durationSec),
  key: item.key ?? "-",
  bpm: item.bpm ?? "-",
  type: item.type,
  likesCount: item.stats.likes,
  isLiked: item.userState.liked,
  jsonPeaksUrl: item.waveformUrl ?? undefined,
});

type CardAction =
  | "open"
  | "like"
  | "unlike"
  | "download"
  | "remake"
  | "edit"
  | "original";

type ActionSpec = { key: CardAction; label: string; disabled?: boolean };

const actionsByTab = (tab: LibraryTab, item: LibraryItem): ActionSpec[] => {
  const processing = item.status === "processing";
  const likeAction: ActionSpec = item.userState.liked
    ? { key: "unlike", label: "Unlike" }
    : { key: "like", label: "Like" };

  if (tab === "liked") {
    return [
      { key: "open", label: "Open sample" },
      likeAction,
      { key: "download", label: "Download" },
      { key: "remake", label: "Add remake" },
    ];
  }

  if (tab === "downloaded") {
    return [
      { key: "open", label: "Open sample" },
      { key: "download", label: "Download again" },
      likeAction,
      { key: "remake", label: "Add remake" },
    ];
  }

  if (tab === "uploads") {
    if (item.status === "failed") {
      return [{ key: "edit", label: "Retry in editor" }];
    }
    return [
      { key: "open", label: "Open sample", disabled: processing },
      { key: "edit", label: "Edit" },
    ];
  }

  return [
    { key: "open", label: "Open remake", disabled: processing },
    { key: "edit", label: "Edit remake" },
    { key: "original", label: "Go to original", disabled: !item.originalSample },
  ];
};

const filterOptionsForTab = (tab: LibraryTab) => {
  if (tab === "uploads") return { name: "status", label: "Status", options: statusFilters };
  if (tab === "remakes") return { name: "status", label: "Status", options: remakeStatusFilters };
  return null;
};

function LibrarySkeletons() {
  return (
    <div className="library-list" aria-label="Loading library">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="library-card library-card--skeleton" key={index}>
          <div className="library-card__cover" />
          <div className="library-card__main">
            <div className="library-skeleton library-skeleton--title" />
            <div className="library-skeleton library-skeleton--tags" />
            <div className="library-skeleton library-skeleton--waveform" />
          </div>
          <div className="library-card__meta">
            <div className="library-skeleton library-skeleton--meta" />
            <div className="library-skeleton library-skeleton--actions" />
          </div>
        </div>
      ))}
    </div>
  );
}

type LibraryCardProps = {
  item: LibraryItem;
  tab: LibraryTab;
  /** The visible list, so prev/next in the mini player follow the library order. */
  queue: Sample[];
  onAction: (action: CardAction, item: LibraryItem) => void;
};

function LibraryCard({ item, tab, queue, onAction }: LibraryCardProps) {
  const { currentSample, state, play, seekTo } = useAudioContextManager();
  const sample = useMemo(() => toSample(item), [item]);
  const isCurrent = String(currentSample?.id) === String(item.id);
  const isPlaying = isCurrent && state.isPlaying;
  const playbackDisabled =
    item.status === "processing" || item.status === "failed" || !item.audioPreviewUrl;

  const handlePlay = () => {
    if (!playbackDisabled) play(sample, { queue });
  };

  const handleWaveformSeek = (event: React.MouseEvent<HTMLDivElement>) => {
    if (playbackDisabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    if (!isCurrent) play(sample, { startProgress: progress, queue });
    else if (state.isReady) seekTo(progress);
  };

  const sampleHref = `/sample/${item.id}`;

  return (
    <article className={`library-card library-card--${item.status ?? "ready"}`}>
      <div className="library-card__cover" aria-hidden="true">
        {item.coverUrl ? <img src={item.coverUrl} alt="" /> : <span>{item.title.slice(0, 2).toUpperCase()}</span>}
      </div>

      <div className="library-card__main">
        <div className="library-card__heading">
          <Link to={`/user/${item.creator.username}`} className="library-card__creator">
            @{item.creator.username}
          </Link>
          <Link to={sampleHref} className="library-card__title">
            {item.title}
          </Link>
          {item.status && (
            <span className={`library-status library-status--${item.status}`}>{item.status}</span>
          )}
        </div>

        {tab === "remakes" && item.originalSample && (
          <div className="library-card__original">
            Original: <Link to={`/sample/${item.originalSample.id}`}>{item.originalSample.title}</Link> by{" "}
            <Link to={`/user/${item.originalSample.creatorUsername}`}>@{item.originalSample.creatorUsername}</Link>
          </div>
        )}

        <div className="library-card__tags">
          {item.tags.map((tag) => (
            <Link key={tag} to={`/feed?tags=${encodeURIComponent(tag)}`}>
              #{tag}
            </Link>
          ))}
        </div>

        <div className="library-card__wave-row">
          <button className="library-card__play" type="button" onClick={handlePlay} disabled={playbackDisabled}>
            {item.status === "processing" ? "..." : isPlaying ? "Pause" : "Play"}
          </button>
          <div className="library-card__waveform" onClick={handleWaveformSeek}>
            {item.waveformUrl ? (
              <WaveformFromJsonForSample
                sample={sample}
                peaksUrl={item.waveformUrl}
                width={260}
                height={44}
                barWidth={3}
                gap={2}
                activeColor="#ffffff"
                inactiveColor="rgba(255,255,255,0.26)"
              />
            ) : (
              <div className="library-card__wave-placeholder" />
            )}
          </div>
        </div>
      </div>

      <div className="library-card__meta">
        <div className="library-card__numbers">
          <span>{formatDuration(item.durationSec)}</span>
          <span>{item.bpm ?? "-"} BPM</span>
          <span>{item.key ?? "-"}</span>
          <span>{item.stats.likes} likes</span>
          <span>{item.stats.plays} plays</span>
        </div>
        <div className="library-card__actions">
          {actionsByTab(tab, item).map((action) => (
            <button
              key={action.key}
              type="button"
              disabled={action.disabled}
              onClick={() => onAction(action.key, item)}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

function LibraryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlState = useMemo(() => readUrlState(searchParams), [searchParams]);
  const { status: authStatus, openAuthModal } = useAuth();
  const authorized = authStatus === "authenticated";
  const { toast, showToast } = useToast();

  const [searchDraft, setSearchDraft] = useState(urlState.search);
  const [continueItems, setContinueItems] = useState<ContinueWorkingItem[]>([]);

  useEffect(() => {
    setSearchDraft(urlState.search);
  }, [urlState.search]);

  const writeUrlState = useCallback(
    (next: Partial<UrlState>) => {
      const merged: UrlState = { ...urlState, ...next };
      if (next.tab && next.tab !== urlState.tab) {
        merged.sort = sortOptions[merged.tab][0].value;
        merged.status = "";
      }

      const params = new URLSearchParams();
      if (merged.tab !== "liked") params.set("tab", merged.tab);
      if (merged.search.trim()) params.set("search", merged.search.trim());
      if (merged.sort && merged.sort !== sortOptions[merged.tab][0].value) params.set("sort", merged.sort);
      if (merged.status) params.set("status", merged.status);

      setSearchParams(params);
    },
    [setSearchParams, urlState]
  );

  useEffect(() => {
    if (!authorized) {
      setContinueItems([]);
      return;
    }
    let active = true;
    getContinueWorkingItems()
      .then((data) => {
        if (active) setContinueItems(data.slice(0, 3));
      })
      .catch(() => {
        if (active) setContinueItems([]);
      });
    return () => {
      active = false;
    };
  }, [authorized]);

  const requestKey = `${urlState.tab}|${urlState.search}|${urlState.sort}|${urlState.status}`;

  const loadPage = useCallback(
    (cursor?: string) =>
      getLibraryItems({
        tab: urlState.tab,
        search: urlState.search || undefined,
        sort: urlState.sort,
        status: urlState.status || undefined,
        cursor,
        limit: 20,
      }).then((response) => ({ items: response.items, nextCursor: response.nextCursor })),
    [urlState.search, urlState.sort, urlState.status, urlState.tab]
  );

  const list = useInfiniteList<LibraryItem>(loadPage, requestKey, { enabled: authorized });
  const queue = useMemo(() => list.items.map(toSample), [list.items]);

  // Debounced search → URL.
  useEffect(() => {
    if (searchDraft === urlState.search) return;
    const handle = window.setTimeout(() => writeUrlState({ search: searchDraft }), 350);
    return () => window.clearTimeout(handle);
  }, [searchDraft, urlState.search, writeUrlState]);

  const patchItem = (id: string, patch: (item: LibraryItem) => LibraryItem) => {
    list.setItems((current) => current.map((item) => (item.id === id ? patch(item) : item)));
  };

  const toggleLike = async (item: LibraryItem, liked: boolean) => {
    const previous = item;
    patchItem(item.id, (current) => ({
      ...current,
      userState: { ...current.userState, liked },
      stats: { ...current.stats, likes: Math.max(0, current.stats.likes + (liked ? 1 : -1)) },
    }));

    try {
      const response = await (liked ? likeSample(item.id) : unlikeSample(item.id));
      patchItem(item.id, (current) => ({
        ...current,
        userState: { ...current.userState, liked: response.liked },
        stats: { ...current.stats, likes: response.likesCount },
      }));
      if (urlState.tab === "liked" && !response.liked) {
        list.setItems((current) => current.filter((entry) => entry.id !== item.id));
      }
    } catch {
      patchItem(item.id, () => previous);
      showToast("error", "Could not save like. Changes reverted.");
    }
  };

  const download = async (item: LibraryItem) => {
    try {
      const response = await requestDownload(item.id);
      window.open(response.downloadUrl, "_blank", "noopener");
      showToast("success", "Download started.");
    } catch {
      showToast("error", "Download is not available right now.");
    }
  };

  const handleAction = (action: CardAction, item: LibraryItem) => {
    switch (action) {
      case "open":
        navigate(`/sample/${item.id}`);
        return;
      case "like":
        void toggleLike(item, true);
        return;
      case "unlike":
        void toggleLike(item, false);
        return;
      case "download":
        void download(item);
        return;
      case "remake":
        navigate(`/sample/${item.id}/remake`);
        return;
      case "edit":
        navigate(`/sample/${item.id}/edit`);
        return;
      case "original":
        if (item.originalSample) navigate(`/sample/${item.originalSample.id}`);
        return;
      default:
        return;
    }
  };

  const filter = filterOptionsForTab(urlState.tab);
  const emptyState = emptyStates[urlState.tab];

  return (
    <main className="library-page">
      <header className="library-header">
        <p className="library-header__eyebrow">Personal workspace</p>
        <h1>Library</h1>
        <p>Your saved, downloaded and created samples.</p>
      </header>

      {authStatus === "loading" ? (
        <LibrarySkeletons />
      ) : !authorized ? (
        <section className="library-state library-state--auth">
          <h2>Sign in to view your library.</h2>
          <p>Your liked, downloaded and uploaded samples will appear here.</p>
          <div className="library-state__actions">
            <button type="button" onClick={() => openAuthModal("login")}>
              Sign In
            </button>
            <button type="button" onClick={() => openAuthModal("signup")}>
              Create Account
            </button>
          </div>
        </section>
      ) : (
        <>
          {continueItems.length > 0 && (
            <section className="library-continue" aria-labelledby="continue-title">
              <h2 id="continue-title">Continue working</h2>
              <div className="library-continue__grid">
                {continueItems.map((item) => (
                  <Link to={item.href} className="library-continue__item" key={item.id}>
                    <span>{item.label}</span>
                    <strong>{item.title}</strong>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <nav className="library-tabs" aria-label="Library tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={urlState.tab === tab.key ? "library-tabs__tab library-tabs__tab--active" : "library-tabs__tab"}
                type="button"
                onClick={() => writeUrlState({ tab: tab.key })}
                aria-current={urlState.tab === tab.key ? "page" : undefined}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <section className="library-context" aria-label="Library controls">
            <label className="library-context__search">
              <span>Search in library</span>
              <input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="title, creator, tag, BPM or key"
                type="search"
              />
            </label>

            <label>
              <span>Sort</span>
              <select value={urlState.sort} onChange={(event) => writeUrlState({ sort: event.target.value })}>
                {sortOptions[urlState.tab].map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {filter && (
              <label>
                <span>{filter.label}</span>
                <select
                  value={urlState.status}
                  onChange={(event) => writeUrlState({ status: event.target.value as LibraryStatus | "" })}
                >
                  {filter.options.map((option) => (
                    <option value={option.value} key={option.value || "all"}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="library-context__view" aria-label="View mode">
              <span>View</span>
              <strong>List</strong>
            </div>
          </section>

          <section className="library-content">
            {list.status === "loading" ? (
              <LibrarySkeletons />
            ) : list.status === "error" ? (
              <div className="library-state">
                <h2>Something went wrong.</h2>
                <p>{list.error ?? "We couldn't load your library."}</p>
                <button type="button" onClick={list.reload}>
                  Retry
                </button>
              </div>
            ) : list.items.length === 0 ? (
              <div className="library-state">
                <h2>{emptyState.title}</h2>
                <p>{emptyState.body}</p>
                <Link to={emptyState.href}>{emptyState.action}</Link>
              </div>
            ) : (
              <>
                <div className="library-list">
                  {list.items.map((item) => (
                    <LibraryCard
                      item={item}
                      tab={urlState.tab}
                      queue={queue}
                      onAction={handleAction}
                      key={item.id}
                    />
                  ))}
                </div>
                <div className="library-load-more" ref={list.sentinelRef}>
                  {list.isLoadingMore ? "Loading more..." : list.hasMore ? "Scroll for more" : "End of library"}
                </div>
              </>
            )}
          </section>
        </>
      )}

      {toast ? (
        <div className={`page-toast page-toast--${toast.tone}`} role="status" aria-live="polite">
          {toast.text}
        </div>
      ) : null}
    </main>
  );
}

export default LibraryPage;
