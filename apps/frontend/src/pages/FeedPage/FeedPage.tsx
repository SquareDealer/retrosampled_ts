import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchSamples, SamplesAccessType, SamplesSort } from "../../api/samples";
import SamplePiece from "../../components/SamplePiece";
import { Sample } from "../../types/Sample";
import "./FeedPage.css";

const TAG_OPTIONS = ["lofi", "drums", "ambient", "synth", "chill", "retro", "80s"];
const KEY_OPTIONS = ["Am", "C", "Dm", "Em", "F", "G", "A"];
const SORT_OPTIONS: Array<{ value: SamplesSort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Popular" },
  { value: "liked", label: "Liked" },
  { value: "remakes", label: "Remakes" },
];
const PAGE_LIMIT = 20;

type FeedPageProps = {
  isAuthorized: boolean;
  onSignInClick: () => void;
};

type FeedFilters = {
  search: string;
  tags: string[];
  bpmMin?: number;
  bpmMax?: number;
  musicalKey: string;
  type: "all" | SamplesAccessType;
  sort: SamplesSort;
};

type FeedFilterUpdates = Omit<Partial<FeedFilters>, "bpmMin" | "bpmMax"> & {
  bpmMin?: number | null;
  bpmMax?: number | null;
};

const parseNumberParam = (value: string | null): number | undefined => {
  if (!value) return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseSort = (value: string | null): SamplesSort => {
  if (value === "popular" || value === "liked" || value === "remakes") {
    return value;
  }

  return "newest";
};

const parseType = (value: string | null): FeedFilters["type"] => {
  if (value === "free" || value === "premium") {
    return value;
  }

  return "all";
};

const getFiltersFromParams = (params: URLSearchParams): FeedFilters => {
  return {
    search: params.get("search") ?? "",
    tags: (params.get("tags") ?? "").split(",").filter(Boolean),
    bpmMin: parseNumberParam(params.get("bpm_min")),
    bpmMax: parseNumberParam(params.get("bpm_max")),
    musicalKey: params.get("key") ?? "",
    type: parseType(params.get("type")),
    sort: parseSort(params.get("sort")),
  };
};

const setParam = (params: URLSearchParams, key: string, value: string | number | undefined) => {
  if (value === undefined || value === "") {
    params.delete(key);
    return;
  }

  params.set(key, String(value));
};

const FeedSkeleton: React.FC = () => {
  return (
    <div className="feed-skeleton" aria-label="Loading samples">
      {Array.from({ length: 6 }).map((_, index) => (
        <div className="feed-skeleton__row" key={index}>
          <div className="feed-skeleton__avatar" />
          <div className="feed-skeleton__copy">
            <div className="feed-skeleton__line feed-skeleton__line--short" />
            <div className="feed-skeleton__line" />
          </div>
          <div className="feed-skeleton__waveform" />
        </div>
      ))}
    </div>
  );
};

const FeedPage: React.FC<FeedPageProps> = ({ isAuthorized, onSignInClick }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = getFiltersFromParams(searchParams);
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRemakeIds, setExpandedRemakeIds] = useState<Set<string>>(() => new Set());
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestIdRef = useRef(0);

  const isLikedLocked = filters.sort === "liked" && !isAuthorized;
  const filtersKey = searchParams.toString();
  const tagsKey = filters.tags.join(",");

  useEffect(() => {
    setSearchDraft(filters.search);
  }, [filters.search]);

  const updateFilters = useCallback(
    (updates: FeedFilterUpdates) => {
      const nextParams = new URLSearchParams(searchParams);

      if ("search" in updates) setParam(nextParams, "search", updates.search?.trim());
      if ("tags" in updates) setParam(nextParams, "tags", updates.tags?.join(","));
      if ("bpmMin" in updates) setParam(nextParams, "bpm_min", updates.bpmMin ?? undefined);
      if ("bpmMax" in updates) setParam(nextParams, "bpm_max", updates.bpmMax ?? undefined);
      if ("musicalKey" in updates) setParam(nextParams, "key", updates.musicalKey);
      if ("type" in updates) setParam(nextParams, "type", updates.type === "all" ? "" : updates.type);
      if ("sort" in updates) setParam(nextParams, "sort", updates.sort === "newest" ? "" : updates.sort);

      setSearchParams(nextParams, { replace: false });
    },
    [searchParams, setSearchParams]
  );

  const loadPage = useCallback(
    async (cursor?: string) => {
      if (isLikedLocked) {
        setSamples([]);
        setNextCursor(undefined);
        setError(null);
        setIsLoading(false);
        setIsLoadingMore(false);
        return;
      }

      const requestId = ++requestIdRef.current;
      if (cursor) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setSamples([]);
      }
      setError(null);

      try {
        const response = await fetchSamples({
          search: filters.search || undefined,
          tags: tagsKey ? tagsKey.split(",") : [],
          bpm_min: filters.bpmMin,
          bpm_max: filters.bpmMax,
          key: filters.musicalKey || undefined,
          type: filters.type === "all" ? undefined : filters.type,
          sort: filters.sort,
          cursor,
          limit: PAGE_LIMIT,
        });

        if (requestId !== requestIdRef.current) {
          return;
        }

        setSamples((current) => (cursor ? [...current, ...response.samples] : response.samples));
        setNextCursor(response.nextCursor);
      } catch {
        if (requestId === requestIdRef.current) {
          setError("Samples failed to load");
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [filters.bpmMax, filters.bpmMin, filters.musicalKey, filters.search, filters.sort, filters.type, isLikedLocked, tagsKey]
  );

  useEffect(() => {
    void loadPage();
  }, [filtersKey, isLikedLocked, loadPage]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !nextCursor || isLoading || isLoadingMore || isLikedLocked) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadPage(nextCursor);
        }
      },
      { rootMargin: "240px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isLikedLocked, isLoading, isLoadingMore, loadPage, nextCursor]);

  const toggleTag = (tag: string) => {
    const nextTags = filters.tags.includes(tag)
      ? filters.tags.filter((selectedTag) => selectedTag !== tag)
      : [...filters.tags, tag];

    updateFilters({ tags: nextTags });
  };

  const toggleRemakes = (sampleId: Sample["id"]) => {
    setExpandedRemakeIds((current) => {
      const next = new Set(current);
      const normalizedId = String(sampleId);

      if (next.has(normalizedId)) {
        next.delete(normalizedId);
      } else {
        next.add(normalizedId);
      }

      return next;
    });
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateFilters({ search: searchDraft });
  };

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.tags.length ||
      filters.bpmMin !== undefined ||
      filters.bpmMax !== undefined ||
      filters.musicalKey ||
      filters.type !== "all" ||
      filters.sort !== "newest"
  );

  return (
    <main className="feed-page">
      <section className="feed-top-bar" aria-label="Feed top controls">
        <form className="feed-top-bar__search" onSubmit={handleSearchSubmit}>
          <label className="feed-control-label" htmlFor="feed-search">
            Search
          </label>
          <input
            id="feed-search"
            className="feed-input"
            type="search"
            placeholder="Search samples"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
          />
        </form>

        <label className="feed-top-bar__sort">
          <span className="feed-control-label">Sort</span>
          <select
            className="feed-select"
            value={filters.sort}
            onChange={(event) => updateFilters({ sort: event.target.value as SamplesSort })}
          >
            {SORT_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="feed-filters-bar" aria-label="Feed filters">
        <div className="feed-filter-group feed-filter-group--tags">
          <span className="feed-filter-title">Tags:</span>
          {TAG_OPTIONS.map((tag) => (
            <button
              className={`feed-chip${filters.tags.includes(tag) ? " feed-chip--active" : ""}`}
              type="button"
              key={tag}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
          <button className="feed-chip" type="button" aria-label="Add tag">
            +
          </button>
        </div>

        <label className="feed-filter-group">
          <span className="feed-filter-title">BPM:</span>
          <input
            className="feed-number-input"
            type="number"
            inputMode="numeric"
            placeholder="80"
            value={filters.bpmMin ?? ""}
            onChange={(event) => updateFilters({ bpmMin: parseNumberParam(event.target.value) ?? null })}
          />
          <span className="feed-filter-title">-</span>
          <input
            className="feed-number-input"
            type="number"
            inputMode="numeric"
            placeholder="120"
            value={filters.bpmMax ?? ""}
            onChange={(event) => updateFilters({ bpmMax: parseNumberParam(event.target.value) ?? null })}
          />
        </label>

        <label className="feed-filter-group">
          <span className="feed-filter-title">Key:</span>
          <select
            className="feed-select feed-select--compact"
            value={filters.musicalKey}
            onChange={(event) => updateFilters({ musicalKey: event.target.value })}
          >
            <option value="">All</option>
            {KEY_OPTIONS.map((key) => (
              <option value={key} key={key}>
                {key}
              </option>
            ))}
          </select>
        </label>

        <label className="feed-filter-group">
          <span className="feed-filter-title">Type:</span>
          <select
            className="feed-select feed-select--compact"
            value={filters.type}
            onChange={(event) => updateFilters({ type: event.target.value as FeedFilters["type"] })}
          >
            <option value="all">All</option>
            <option value="free">Free</option>
            <option value="premium">Premium</option>
          </select>
        </label>

        <button
          className="feed-reset-button"
          type="button"
          disabled={!hasActiveFilters}
          onClick={() => setSearchParams(new URLSearchParams())}
        >
          Reset
        </button>
      </section>

      <section className="feed-content-list" aria-label="Samples list">
        {isLikedLocked ? (
          <div className="feed-state">
            <h1>Sign in to see your liked samples</h1>
            <button className="feed-state__button" type="button" onClick={onSignInClick}>
              Sign in
            </button>
          </div>
        ) : isLoading ? (
          <FeedSkeleton />
        ) : error ? (
          <div className="feed-state">
            <h1>{error}</h1>
            <button className="feed-state__button" type="button" onClick={() => void loadPage()}>
              Retry
            </button>
          </div>
        ) : samples.length ? (
          <>
            <div className="samples-container">
              {samples.map((sample) => {
                const sampleId = String(sample.id);
                const isExpanded = expandedRemakeIds.has(sampleId);
                const remakes = sample.remakes ?? [];

                return (
                  <div
                    className={`feed-sample-group${isExpanded ? " feed-sample-group--expanded" : ""}`}
                    key={sample.id}
                  >
                    <SamplePiece
                      sample={sample}
                      remakesExpanded={isExpanded}
                      onRemakesToggle={remakes.length ? () => toggleRemakes(sample.id) : undefined}
                    />
                    {isExpanded && remakes.length > 0 && (
                      <div className="feed-remakes-list" aria-label={`Remakes for ${sample.title}`}>
                        {remakes.map((remake) => (
                          <SamplePiece sample={remake} compact key={remake.id} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {isLoadingMore && <FeedSkeleton />}
            <div className="feed-scroll-sentinel" ref={sentinelRef} aria-hidden="true" />
          </>
        ) : (
          <div className="feed-state">
            <h1>No samples found</h1>
            <p>Try changing filters</p>
          </div>
        )}
      </section>
    </main>
  );
};

export default FeedPage;
