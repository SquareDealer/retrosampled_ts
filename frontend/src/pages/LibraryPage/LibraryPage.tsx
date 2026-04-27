import React, { useEffect, useMemo, useRef, useState } from "react";
import { getContinueWorkingItems, getLibraryItems, isLibraryAuthorized } from "../../api/library";
import { useAudioContextManager } from "../../components/AudioContextManager";
import { WaveformFromJsonForSample } from "../../components/waveform/WaveformFromJsonForSample";
import { ContinueWorkingItem, LibraryAccessType, LibraryItem, LibraryStatus, LibraryTab } from "../../types/Library";
import { Sample } from "../../types/Sample";
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

const remakeStatusFilters: FilterOption[] = statusFilters.filter((option) => option.value !== "processing" && option.value !== "failed");

const typeFilters: FilterOption[] = [
  { value: "", label: "All" },
  { value: "free", label: "Free" },
  { value: "premium", label: "Premium" },
];

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

const validTabs = new Set<LibraryTab>(["liked", "downloaded", "uploads", "remakes"]);

const readUrlState = () => {
  const params = new URLSearchParams(window.location.search);
  const requestedTab = params.get("tab") as LibraryTab | null;
  const tab = requestedTab && validTabs.has(requestedTab) ? requestedTab : "liked";
  const defaultSort = sortOptions[tab][0].value;

  return {
    tab,
    search: params.get("search") ?? "",
    sort: params.get("sort") ?? defaultSort,
    status: (params.get("status") ?? "") as LibraryStatus | "",
    type: (params.get("type") ?? "") as LibraryAccessType | "",
    view: params.get("view") === "grid" ? "grid" : "list",
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
  price: item.accessType === "premium" ? "Premium" : "Free",
  jsonPeaksUrl: item.waveformUrl ?? undefined,
});

const actionsByTab = (tab: LibraryTab, item: LibraryItem) => {
  if (tab === "liked") return ["Open sample", "Unlike", "Download", "Add remake"];
  if (tab === "downloaded") return ["Open sample", "Download again", item.userState.liked ? "Unlike" : "Like", "Add remake"];
  if (tab === "uploads") {
    if (item.status === "failed") return ["Retry", "Delete"];
    return ["Open sample", "Edit", item.status === "private" ? "Publish" : "Make private", "View stats", "Delete"];
  }
  return ["Open remake", "Edit remake", "Go to original", item.status === "private" ? "Publish" : "Make private", "Delete"];
};

const filterOptionsForTab = (tab: LibraryTab) => {
  if (tab === "downloaded") return { name: "type", label: "Type", options: typeFilters };
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

function LibraryCard({ item, tab }: { item: LibraryItem; tab: LibraryTab }) {
  const { currentSample, state, play, seekTo } = useAudioContextManager();
  const sample = useMemo(() => toSample(item), [item]);
  const isCurrent = currentSample?.id === item.id;
  const isPlaying = isCurrent && state.isPlaying;
  const playbackDisabled = item.status === "processing" || item.status === "failed" || !item.audioPreviewUrl;

  const handlePlay = () => {
    if (!playbackDisabled) play(sample);
  };

  const handleWaveformSeek = (event: React.MouseEvent<HTMLDivElement>) => {
    if (playbackDisabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    if (!isCurrent) play(sample, progress);
    else if (state.isReady) seekTo(progress);
  };

  return (
    <article className={`library-card library-card--${item.status ?? "ready"}`}>
      <div className="library-card__cover" aria-hidden="true">
        {item.coverUrl ? <img src={item.coverUrl} alt="" /> : <span>{item.title.slice(0, 2).toUpperCase()}</span>}
      </div>

      <div className="library-card__main">
        <div className="library-card__heading">
          <a href={`/user/${item.creator.id}`} className="library-card__creator">{item.creator.username}</a>
          <a href={`/${item.type === "remake" ? "remakes" : "samples"}/${item.id}`} className="library-card__title">{item.title}</a>
          {item.status && <span className={`library-status library-status--${item.status}`}>{item.status}</span>}
        </div>

        {tab === "remakes" && item.originalSample && (
          <div className="library-card__original">
            Original: <a href={`/samples/${item.originalSample.id}`}>{item.originalSample.title}</a> by {item.originalSample.creatorUsername}
          </div>
        )}

        <div className="library-card__tags">
          {item.tags.map((tag) => <span key={tag}>#{tag}</span>)}
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
            <button key={action} type="button" disabled={item.status === "processing" && (action === "Open sample" || action === "Publish")}>
              {action}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

function LibraryPage() {
  const [urlState, setUrlState] = useState(readUrlState);
  const [authorized, setAuthorized] = useState(() => isLibraryAuthorized());
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [continueItems, setContinueItems] = useState<ContinueWorkingItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const activeSortOptions = sortOptions[urlState.tab];
  const selectedSort = activeSortOptions.some((option) => option.value === urlState.sort)
    ? urlState.sort
    : activeSortOptions[0].value;
  const requestKey = `${urlState.tab}|${urlState.search}|${selectedSort}|${urlState.status}|${urlState.type}`;

  const writeUrlState = (next: Partial<typeof urlState>) => {
    setUrlState((current) => {
      const merged = { ...current, ...next };
      const tabChanged = next.tab && next.tab !== current.tab;
      if (tabChanged) {
        merged.sort = sortOptions[merged.tab][0].value;
        merged.status = "";
        merged.type = "";
      }

      const params = new URLSearchParams();
      params.set("tab", merged.tab);
      if (merged.search.trim()) params.set("search", merged.search.trim());
      if (merged.sort && merged.sort !== sortOptions[merged.tab][0].value) params.set("sort", merged.sort);
      if (merged.status) params.set("status", merged.status);
      if (merged.type) params.set("type", merged.type);
      if (merged.view !== "list") params.set("view", merged.view);

      window.history.pushState(null, "", `/library?${params.toString()}`);
      return merged;
    });
  };

  useEffect(() => {
    const onPopState = () => setUrlState(readUrlState());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    setAuthorized(isLibraryAuthorized());
    getContinueWorkingItems().then((data) => setContinueItems(data.slice(0, 3)));
  }, []);

  useEffect(() => {
    if (!authorized) return;
    let active = true;
    setLoading(true);
    setError(false);
    setItems([]);
    setNextCursor(null);

    getLibraryItems({
      tab: urlState.tab,
      search: urlState.search || undefined,
      sort: selectedSort,
      status: urlState.status || undefined,
      type: urlState.type || undefined,
      limit: 20,
    })
      .then((response) => {
        if (!active) return;
        setItems(response.items);
        setNextCursor(response.nextCursor);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authorized, requestKey, selectedSort, urlState.search, urlState.status, urlState.tab, urlState.type]);

  const loadMore = () => {
    if (!authorized || loading || loadingMore || !nextCursor) return;
    setLoadingMore(true);
    getLibraryItems({
      tab: urlState.tab,
      search: urlState.search || undefined,
      sort: selectedSort,
      status: urlState.status || undefined,
      type: urlState.type || undefined,
      cursor: nextCursor,
      limit: 20,
    })
      .then((response) => {
        setItems((current) => [...current, ...response.items]);
        setNextCursor(response.nextCursor);
      })
      .catch(() => setError(true))
      .finally(() => setLoadingMore(false));
  };

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    }, { rootMargin: "240px" });
    observer.observe(node);
    return () => observer.disconnect();
  });

  const filter = filterOptionsForTab(urlState.tab);
  const emptyState = emptyStates[urlState.tab];

  return (
    <main className="library-page">
      <header className="library-header">
        <p className="library-header__eyebrow">Personal workspace</p>
        <h1>Library</h1>
        <p>Your saved, downloaded and created samples.</p>
      </header>

      {!authorized ? (
        <section className="library-state library-state--auth">
          <h2>Sign in to view your library.</h2>
          <p>Your liked, downloaded and uploaded samples will appear here.</p>
          <div className="library-state__actions">
            <a href="/signin">Sign In</a>
            <a href="/signup">Create Account</a>
          </div>
        </section>
      ) : (
        <>
          {continueItems.length > 0 && (
            <section className="library-continue" aria-labelledby="continue-title">
              <h2 id="continue-title">Continue working</h2>
              <div className="library-continue__grid">
                {continueItems.map((item) => (
                  <a href={item.href} className="library-continue__item" key={item.id}>
                    <span>{item.label}</span>
                    <strong>{item.title}</strong>
                  </a>
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
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <section className="library-context" aria-label="Library controls">
            <label className="library-context__search">
              <span>Search in library</span>
              <input
                value={urlState.search}
                onChange={(event) => writeUrlState({ search: event.target.value })}
                placeholder="title, creator, tag, BPM or key"
                type="search"
              />
            </label>

            <label>
              <span>Sort</span>
              <select value={selectedSort} onChange={(event) => writeUrlState({ sort: event.target.value })}>
                {activeSortOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
              </select>
            </label>

            {filter && (
              <label>
                <span>{filter.label}</span>
                <select
                  value={filter.name === "type" ? urlState.type : urlState.status}
                  onChange={(event) => writeUrlState(filter.name === "type" ? { type: event.target.value as LibraryAccessType | "" } : { status: event.target.value as LibraryStatus | "" })}
                >
                  {filter.options.map((option) => <option value={option.value} key={option.value || "all"}>{option.label}</option>)}
                </select>
              </label>
            )}

            <div className="library-context__view" aria-label="View mode">
              <span>View</span>
              <strong>List</strong>
            </div>
          </section>

          <section className="library-content">
            {loading ? <LibrarySkeletons /> : error ? (
              <div className="library-state">
                <h2>Something went wrong.</h2>
                <p>We couldn't load your library.</p>
                <button type="button" onClick={() => setUrlState((current) => ({ ...current }))}>Retry</button>
              </div>
            ) : items.length === 0 ? (
              <div className="library-state">
                <h2>{emptyState.title}</h2>
                <p>{emptyState.body}</p>
                <a href={emptyState.href}>{emptyState.action}</a>
              </div>
            ) : (
              <>
                <div className="library-list">
                  {items.map((item) => <LibraryCard item={item} tab={urlState.tab} key={item.id} />)}
                </div>
                <div className="library-load-more" ref={loadMoreRef}>
                  {loadingMore ? "Loading more..." : nextCursor ? "Scroll for more" : "End of library"}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}

export default LibraryPage;
