import { useCallback, useEffect, useRef, useState } from "react";
import { toggleLike } from "../api/samples";
import { useAuth } from "../auth/useAuth";

export type UseLikeSampleOptions = {
  /** Called with a readable message when the request fails (state is rolled back first). */
  onError?: (message: string) => void;
};

export type LikeState = {
  isLiked: boolean;
  likesCount: number;
  isPending: boolean;
  /** Optimistic toggle; guests get the login modal instead. */
  toggle: () => Promise<void>;
};

/**
 * One optimistic like implementation for rows, related samples and the
 * sample page. Guests are sent to the auth modal; failures roll back to the
 * previous state and report through `onError`.
 */
export function useLikeSample(
  sampleId: string,
  initial: { isLiked?: boolean; likesCount?: number },
  options: UseLikeSampleOptions = {}
): LikeState {
  const { status, openAuthModal } = useAuth();
  const [isLiked, setIsLiked] = useState(Boolean(initial.isLiked));
  const [likesCount, setLikesCount] = useState(Math.max(0, initial.likesCount ?? 0));
  const [isPending, setIsPending] = useState(false);
  const onErrorRef = useRef(options.onError);
  onErrorRef.current = options.onError;

  const initialLiked = Boolean(initial.isLiked);
  const initialCount = Math.max(0, initial.likesCount ?? 0);

  // Re-sync when the row is swapped for another sample or refetched.
  useEffect(() => {
    setIsLiked(initialLiked);
    setLikesCount(initialCount);
  }, [sampleId, initialLiked, initialCount]);

  const toggle = useCallback(async () => {
    if (status !== "authenticated") {
      openAuthModal("login");
      return;
    }

    if (isPending) {
      return;
    }

    const previousLiked = isLiked;
    const previousCount = likesCount;
    const nextLiked = !previousLiked;

    setIsLiked(nextLiked);
    setLikesCount(nextLiked ? previousCount + 1 : Math.max(0, previousCount - 1));
    setIsPending(true);

    try {
      const response = await toggleLike(sampleId, nextLiked);
      setIsLiked(response.liked);
      if (typeof response.likesCount === "number" && response.likesCount >= 0) {
        setLikesCount(response.likesCount);
      }
    } catch (error) {
      setIsLiked(previousLiked);
      setLikesCount(previousCount);
      const message = error instanceof Error ? error.message : "Could not save like.";
      onErrorRef.current?.(message);
    } finally {
      setIsPending(false);
    }
  }, [isLiked, isPending, likesCount, openAuthModal, sampleId, status]);

  return { isLiked, likesCount, isPending, toggle };
}
