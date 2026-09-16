import { useCallback, useEffect, useRef, useState } from "react";

export type Page<T> = {
  items: T[];
  nextCursor?: string | null;
};

export type InfiniteListStatus = "loading" | "loaded" | "error";

export type UseInfiniteListResult<T> = {
  items: T[];
  status: InfiniteListStatus;
  error: string | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
  reload: () => void;
  /** Attach to an element at the end of the list to auto-load on scroll. */
  sentinelRef: (node: HTMLElement | null) => void;
  /** Replace items locally (optimistic updates). */
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
};

/**
 * Cursor-paginated list with infinite scroll. `loadPage` is re-run from the
 * first page whenever `key` changes (put the serialized filters in it).
 */
export function useInfiniteList<T>(
  loadPage: (cursor?: string) => Promise<Page<T>>,
  key: string,
  options: { enabled?: boolean; rootMargin?: string } = {}
): UseInfiniteListResult<T> {
  const { enabled = true, rootMargin = "240px" } = options;
  const [items, setItems] = useState<T[]>([]);
  const [status, setStatus] = useState<InfiniteListStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);

  const requestIdRef = useRef(0);
  const loadPageRef = useRef(loadPage);
  loadPageRef.current = loadPage;

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setNextCursor(null);
      setStatus("loaded");
      return;
    }

    const requestId = ++requestIdRef.current;
    setStatus("loading");
    setError(null);
    setItems([]);
    setNextCursor(null);

    loadPageRef
      .current()
      .then((page) => {
        if (requestId !== requestIdRef.current) return;
        setItems(page.items);
        setNextCursor(page.nextCursor ?? null);
        setStatus("loaded");
      })
      .catch((cause: unknown) => {
        if (requestId !== requestIdRef.current) return;
        setError(cause instanceof Error ? cause.message : "Failed to load");
        setStatus("error");
      });
  }, [enabled, key, reloadToken]);

  const loadMore = useCallback(() => {
    if (!enabled || !nextCursor || isLoadingMore || status !== "loaded") return;

    const requestId = requestIdRef.current;
    setIsLoadingMore(true);

    loadPageRef
      .current(nextCursor)
      .then((page) => {
        if (requestId !== requestIdRef.current) return;
        setItems((current) => [...current, ...page.items]);
        setNextCursor(page.nextCursor ?? null);
      })
      .catch((cause: unknown) => {
        if (requestId !== requestIdRef.current) return;
        setError(cause instanceof Error ? cause.message : "Failed to load more");
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setIsLoadingMore(false);
      });
  }, [enabled, isLoadingMore, nextCursor, status]);

  useEffect(() => {
    if (!sentinel || !nextCursor || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, nextCursor, rootMargin, sentinel]);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  return {
    items,
    status,
    error,
    hasMore: Boolean(nextCursor),
    isLoadingMore,
    loadMore,
    reload,
    sentinelRef: setSentinel,
    setItems,
  };
}

export default useInfiniteList;
