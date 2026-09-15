import React from "react";
import { can } from "@retrosampled/shared";
import { useAuth } from "../../auth/useAuth";
import { useFollow } from "../../hooks/useFollow";

type FollowButtonProps = {
  userId: string;
  username: string;
  initialFollowing: boolean;
  initialFollowersCount?: number;
  onChange?: (state: { following: boolean; followersCount: number }) => void;
  onError?: (error: unknown) => void;
  className?: string;
};

/**
 * Follow / Following toggle gated by `can(actor, "user:follow", user)`: guests
 * get the login modal, nobody sees a button for themselves.
 */
export const FollowButton: React.FC<FollowButtonProps> = ({
  userId,
  username,
  initialFollowing,
  initialFollowersCount,
  onChange,
  onError,
  className = "",
}) => {
  const { user, status, openAuthModal } = useAuth();
  const actor = user ? { id: user.id, role: user.role } : null;
  const allowed = can(actor, "user:follow", { kind: "user", id: userId });
  const { isFollowing, isPending, toggle } = useFollow({
    userId,
    initialFollowing,
    initialFollowersCount,
    onChange,
    onError,
  });

  if (status === "loading") {
    return null;
  }

  if (!user) {
    return (
      <button
        type="button"
        className={`social-btn social-btn--primary ${className}`}
        onClick={() => openAuthModal("login")}
        aria-label={`Follow @${username}`}
      >
        Follow
      </button>
    );
  }

  if (!allowed) {
    return null;
  }

  return (
    <button
      type="button"
      className={`social-btn ${isFollowing ? "" : "social-btn--primary"} ${className}`}
      onClick={() => void toggle()}
      disabled={isPending}
      aria-pressed={isFollowing}
      aria-label={`${isFollowing ? "Unfollow" : "Follow"} @${username}`}
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
};

export default FollowButton;
