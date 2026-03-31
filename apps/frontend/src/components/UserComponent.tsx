import React from 'react';

export type UserProfile = {
  nickname: string;
  bio: string;
  avatarUrl: string;
  followers?: number;
  following?: number;
  socials?: {
    twitter?: string | null;
    instagram?: string | null;
    youtube?: string | null;
    soundcloud?: string | null;
  };
};

interface UserProfileHeaderProps {
  avatarUrl: string;
  nickname: string;
}

const UserProfileHeader: React.FC<UserProfileHeaderProps> = ({ avatarUrl, nickname }) => (
  <div className="user-profile__header">
    <img 
      src={avatarUrl} 
      alt="User Avatar" 
      className="user-profile__avatar" 
    />
    <span className="user-profile__tag">@{nickname}</span>
  </div>
);

interface UserProfileInfoProps {
  nickname: string;
  bio: string;
}

const UserProfileInfo: React.FC<UserProfileInfoProps> = ({ nickname, bio }) => (
  <div className="user-profile__info">
    <h1 className="user-profile__nickname">{nickname}</h1>
    <p className="user-profile__bio">{bio}</p>
  </div>
);

interface UserProfileActionsProps {
  onFollow?: () => void;
  onSubscribe?: () => void;
}

const UserProfileActions: React.FC<UserProfileActionsProps> = ({ onFollow, onSubscribe }) => (
  <div className="user-profile__actions">
    <button 
      className="user-profile__btn user-profile__btn--follow"
      onClick={onFollow}
    >
      follow
    </button>
    <button 
      className="user-profile__btn user-profile__btn--subscribe"
      onClick={onSubscribe}
    >
      subscribe
    </button>
  </div>
);

interface UserProfileStatInfoProps {
  followers?: number;
  following?: number;
}

const UserProfileStatInfo: React.FC<UserProfileStatInfoProps> = ({ followers = 0, following = 0 }) => (
  <div className="user-profile__followers-info">
    <div className="user-profile__stat">
      <span className="user-profile__stat-value">{formatFollowers(followers)}</span>
      <span className="user-profile__stat-label">followers</span>
    </div>
    <div className="user-profile__stat">
      <span className="user-profile__stat-value">{formatFollowers(following)}</span>
      <span className="user-profile__stat-label">following</span>
    </div>
  </div>
);

function formatFollowers(num?: number): string {
  if (!num) return '0';
  if (num >= 10000) {
    return (num / 1000).toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }) + 'K';
  }
  return num.toLocaleString('en-US');
}

interface UserSocialsProps {
  socials?: {
    twitter?: string | null;
    instagram?: string | null;
    youtube?: string | null;
    soundcloud?: string | null;
  };
}

const UserSocialsInfo: React.FC<UserSocialsProps> = ({ socials }) => {
  if (!socials) return null;

  const socialLinks = Object.entries(socials).filter(([_, tag]) => tag);

  if (socialLinks.length === 0) return null;

  const getSocialIcon = (platform: string): string => {
    const iconMap: Record<string, string> = {
      twitter: '/img/socials/x.png',
      instagram: '/img/socials/instagram.png',
      youtube: '/img/socials/youtube.png'
    };
    return iconMap[platform] || '';
  };

  const buildSocialUrl = (platform: string, tag: string): string => {
    const urlMap: Record<string, string> = {
      twitter: `https://twitter.com/${tag.replace('@', '')}`,
      instagram: `https://instagram.com/${tag.replace('@', '')}`,
      youtube: `https://youtube.com/@${tag.replace('@', '')}`,
      soundcloud: `https://soundcloud.com/${tag.replace('@', '')}`
    };
    return urlMap[platform] || '#';
  };

  return (
    <div className="user-profile__socials">
      {socialLinks.map(([platform, tag]) => (
        <a 
          key={platform} 
          href={buildSocialUrl(platform, tag as string)} 
          target="_blank" 
          rel="noopener noreferrer" 
          className={`user-profile__social-link user-profile__social-link--${platform}`}
        >
          {getSocialIcon(platform) && (
            <img 
              src={getSocialIcon(platform)} 
              alt={platform} 
              className="user-profile__social-icon"
            />
          )}
          <span className="user-profile__social-name">{tag}</span>
        </a>
      ))}
    </div>
  );
};

interface UserPageProps {
  user?: UserProfile;
  onFollow?: () => void;
  onSubscribe?: () => void;
}

const UserComponent: React.FC<UserPageProps> = ({ user, onFollow, onSubscribe }) => {
  const { 
    avatarUrl = "/img/avatar.jpg", 
    nickname = "squaredealer", 
    bio = "Sound designer & music producer based in Tokyo. Creating retro-inspired samples for your next hit.",
    followers = 1205,
    following = 45,
    socials = {
      twitter: "@squaredealer",
      instagram: "@squaredealer",
      youtube: "@squaredealer"
    }
  } = user || {};

  return (
    <div className="profile-wrapper">
      <div className="user-profile__content">
        <UserProfileHeader avatarUrl={avatarUrl} nickname={nickname} />
        
        <div className="user-profile__main">
          <UserProfileInfo nickname={nickname} bio={bio} />
          <UserProfileActions onFollow={onFollow} onSubscribe={onSubscribe} />
        </div>
      </div>
      <div className="user-profile__socials-section">
        <UserProfileStatInfo followers={followers} following={following} />
        <UserSocialsInfo socials={socials} />
      </div>
    </div>
  );
};

export default UserComponent;
