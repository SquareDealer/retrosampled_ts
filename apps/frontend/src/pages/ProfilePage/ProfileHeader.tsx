import React from "react";
import { Link } from "react-router-dom";
import type { PublicUserDto } from "@retrosampled/shared";
import { formatCompactNumber } from "../../utils/formatCompactNumber";
import Avatar from "./Avatar";
import FollowButton from "./FollowButton";

type ProfileHeaderProps = {
  user: PublicUserDto;
  followersCount: number;
  onFollowChange: (state: { following: boolean; followersCount: number }) => void;
  onFollowError: (error: unknown) => void;
};

const LINK_LABELS: Record<string, string> = {
  x: "X",
  twitter: "X",
  instagram: "Instagram",
  youtube: "YouTube",
  soundcloud: "SoundCloud",
  bandcamp: "Bandcamp",
  website: "Website",
};

const toHref = (value: string): string => {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value.replace(/^\/+/, "")}`;
};

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  user,
  followersCount,
  onFollowChange,
  onFollowError,
}) => {
  const links = Object.entries(user.links).filter(([, value]) => Boolean(value));

  return (
    <header className="profile-header">
      <div className="profile-header__avatar-col">
        <Avatar src={user.avatarUrl} username={user.username} />
        <span className="profile-header__handle">@{user.username}</span>
      </div>

      <div className="profile-header__main">
        <h1 className="profile-header__name">{user.displayName || user.username}</h1>

        {user.bio ? <p className="profile-header__bio">{user.bio}</p> : null}

        <div className="profile-header__actions">
          {user.isMe ? (
            <Link to="/settings" className="social-btn">
              Edit profile
            </Link>
          ) : (
            <FollowButton
              userId={user.id}
              username={user.username}
              initialFollowing={user.isFollowing}
              initialFollowersCount={user.stats.followers}
              onChange={onFollowChange}
              onError={onFollowError}
            />
          )}
        </div>

        <ul className="profile-stats" aria-label="Profile stats">
          <li>
            <Link className="profile-stats__link" to={`/user/${user.username}/followers`}>
              <strong>{formatCompactNumber(followersCount)}</strong> followers
            </Link>
          </li>
          <li>
            <Link className="profile-stats__link" to={`/user/${user.username}/following`}>
              <strong>{formatCompactNumber(user.stats.following)}</strong> following
            </Link>
          </li>
          <li className="profile-stats__item">
            <strong>{formatCompactNumber(user.stats.uploads)}</strong> uploads
          </li>
          <li className="profile-stats__item">
            <strong>{formatCompactNumber(user.stats.remakes)}</strong> remakes
          </li>
          <li className="profile-stats__item">
            <strong>{formatCompactNumber(user.stats.likesReceived)}</strong> likes
          </li>
        </ul>

        {links.length > 0 ? (
          <div className="profile-links" aria-label="Links">
            {links.map(([key, value]) => (
              <a
                key={key}
                className="profile-links__item"
                href={toHref(value)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {LINK_LABELS[key.toLowerCase()] ?? key}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
};

export default ProfileHeader;
