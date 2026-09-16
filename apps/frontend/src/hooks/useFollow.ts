import { useCallback, useEffect, useRef, useState } from "react";
import { setFollowing } from "../api/follows";

export type UseFollowOptions = {
  userId: string;
  initialFollowing: boolean;
  initialFollowersCount?: number;
  /** Called with the server's answer after a successful toggle. */
  onChange?: (state: { following: boolean; followersCount: number }) => void;
  /** Called when the request fails (after the optimistic state is rolled back). */
  onError?: (error: unknown) => void;
};

export type UseFollowResult = {
  isFollowing: boolean;
  followersCount: number;
  isPending: boolean;
  toggle: () => Promise<void>;
};

/**
 * Optimistic follow / unfollow. The UI flips immediately; on failure both the
 * flag and the follower count are rolled back to what they were.
 */
export function useFollow({
  userId,
  initialFollowing,
  initialFollowersCount = 0,
  onChange,
  onError,
}: UseFollowOptions): UseFollowResult {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [followersCount, setFollowersCount] = useState(initialFollowersCount);
  const [isPending, setIsPending] = useState(false);
  const pendingRef = useRef(false);

  // Re-sync when the profile (or its server state) changes underneath us.
  useEffect(() => {
    setIsFollowing(initialFollowing);
    setFollowersCount(initialFollowersCount);
  }, [userId, initialFollowing, initialFollowersCount]);

  const toggle = useCallback(async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setIsPending(true);

    const previousFollowing = isFollowing;
    const previousCount = followersCount;
    const next = !previousFollowing;

    setIsFollowing(next);
    setFollowersCount(Math.max(0, previousCount + (next ? 1 : -1)));

    try {
      const response = await setFollowing(userId, next);
      setIsFollowing(response.following);
      setFollowersCount(response.followersCount);
      onChange?.(response);
    } catch (error) {
      setIsFollowing(previousFollowing);
      setFollowersCount(previousCount);
      onError?.(error);
    } finally {
      pendingRef.current = false;
      setIsPending(false);
    }
  }, [followersCount, isFollowing, onChange, onError, userId]);

  return { isFollowing, followersCount, isPending, toggle };
}

export default useFollow;
