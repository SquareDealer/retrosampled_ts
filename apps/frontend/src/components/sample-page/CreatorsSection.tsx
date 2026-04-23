import React, { useMemo, useState } from "react";
import {
  CREATOR_ROLE_PRIORITY,
  CreatorRole,
  CreatorViewModel,
} from "../../types/sampleDetail";
import { formatCompactNumber } from "../../utils/formatCompactNumber";

const ROLE_LABELS: Record<CreatorRole, string> = {
  OG_CREATOR: "OG",
  INHERITED_OG_CREATOR: "Inherited OG",
  CURRENT_CREATOR: "Creator",
  COLLABORATOR: "Collab",
};

const ROLE_PRIORITY_INDEX = CREATOR_ROLE_PRIORITY.reduce<Record<CreatorRole, number>>(
  (result, role, index) => {
    result[role] = index;
    return result;
  },
  {
    OG_CREATOR: 0,
    INHERITED_OG_CREATOR: 1,
    CURRENT_CREATOR: 2,
    COLLABORATOR: 3,
  }
);

const MAX_VISIBLE_BADGES = 2;

type CreatorsSectionProps = {
  creators: CreatorViewModel[];
  onFollowToggle: (creatorId: string) => void;
  onCreatorOpen: (creatorId: string) => void;
  loadingCreatorIds?: string[];
  isFollowDisabled?: boolean;
};

type CreatorCardProps = {
  creator: CreatorViewModel;
  isLoading: boolean;
  isFollowDisabled: boolean;
  onFollowToggle: () => void;
  onOpen: () => void;
};

const sortRoles = (roles: CreatorRole[]): CreatorRole[] => {
  return [...roles].sort((roleA, roleB) => ROLE_PRIORITY_INDEX[roleA] - ROLE_PRIORITY_INDEX[roleB]);
};

const getInitials = (username: string): string => {
  const clean = username.replace(/^@/, "").trim();
  if (!clean) {
    return "?";
  }

  return clean.slice(0, 2).toUpperCase();
};

const CreatorAvatar: React.FC<{ avatarUrl?: string; username: string }> = ({ avatarUrl, username }) => {
  const [hasError, setHasError] = useState(false);

  if (!avatarUrl || hasError) {
    return (
      <div className="creators-card__avatar creators-card__avatar--fallback" aria-hidden="true">
        {getInitials(username)}
      </div>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt={`Avatar of @${username}`}
      className="creators-card__avatar"
      onError={() => setHasError(true)}
    />
  );
};

const CreatorCard: React.FC<CreatorCardProps> = ({
  creator,
  isLoading,
  isFollowDisabled,
  onFollowToggle,
  onOpen,
}) => {
  const sortedRoles = useMemo(() => sortRoles(creator.roles), [creator.roles]);
  const visibleRoles = sortedRoles.slice(0, MAX_VISIBLE_BADGES);
  const hiddenRolesCount = Math.max(0, sortedRoles.length - visibleRoles.length);

  const followLabel = isLoading
    ? "Loading"
    : isFollowDisabled
      ? "Disabled"
      : creator.isFollowing
        ? "Following"
        : "Follow";

  const isButtonDisabled = isLoading || isFollowDisabled;

  const handleFollowClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onFollowToggle();
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <article
      className="creators-card"
      role="button"
      tabIndex={0}
      aria-label={`Open creator profile @${creator.username}`}
      onClick={onOpen}
      onKeyDown={handleCardKeyDown}
    >
      <div className="creators-card__badges" aria-label="Creator roles">
        {visibleRoles.map((role) => (
          <span key={`${creator.id}-${role}`} className="creators-card__badge">
            {ROLE_LABELS[role]}
          </span>
        ))}

        {hiddenRolesCount > 0 ? (
          <span className="creators-card__badge creators-card__badge--muted">+{hiddenRolesCount}</span>
        ) : null}
      </div>

      <CreatorAvatar avatarUrl={creator.avatarUrl} username={creator.username} />

      <div className="creators-card__username">@{creator.username}</div>

      <ul className="creators-card__stats" aria-label={`Stats for @${creator.username}`}>
        <li className="creators-card__stat" aria-label="Followers count">
          <span className="creators-card__stat-value">
            {formatCompactNumber(creator.stats.followersCount)}
          </span>
          <span
            className="creators-card__stat-icon creators-card__stat-icon--followers"
            aria-hidden="true"
          />
        </li>
        <li className="creators-card__stat" aria-label="Remakes made count">
          <span className="creators-card__stat-value">
            {formatCompactNumber(creator.stats.remakesMadeCount)}
          </span>
          <span
            className="creators-card__stat-icon creators-card__stat-icon--remakes"
            aria-hidden="true"
          />
        </li>
        <li className="creators-card__stat" aria-label="Tracks remixed count">
          <span className="creators-card__stat-value">
            {formatCompactNumber(creator.stats.tracksRemixedCount)}
          </span>
          <span
            className="creators-card__stat-icon creators-card__stat-icon--tracks"
            aria-hidden="true"
          />
        </li>
      </ul>

      <button
        type="button"
        className={`creators-card__follow${creator.isFollowing ? " creators-card__follow--following" : ""}${
          isButtonDisabled ? " creators-card__follow--disabled" : ""
        }`}
        onClick={handleFollowClick}
        disabled={isButtonDisabled}
        aria-label={`${followLabel} @${creator.username}`}
      >
        {followLabel}
      </button>
    </article>
  );
};

export const CreatorsSection: React.FC<CreatorsSectionProps> = ({
  creators,
  onFollowToggle,
  onCreatorOpen,
  loadingCreatorIds,
  isFollowDisabled = false,
}) => {
  const loadingSet = useMemo(() => new Set(loadingCreatorIds ?? []), [loadingCreatorIds]);

  return (
    <section className="creators-section" aria-label="Creators">
      <h2 className="creators-section__title">Creators:</h2>

      {creators.length > 0 ? (
        <div className="creators-section__grid">
          {creators.map((creator) => (
            <CreatorCard
              key={creator.id}
              creator={creator}
              isLoading={loadingSet.has(creator.id)}
              isFollowDisabled={isFollowDisabled}
              onFollowToggle={() => onFollowToggle(creator.id)}
              onOpen={() => onCreatorOpen(creator.id)}
            />
          ))}
        </div>
      ) : (
        <p className="creators-section__empty">No creators available yet.</p>
      )}
    </section>
  );
};
