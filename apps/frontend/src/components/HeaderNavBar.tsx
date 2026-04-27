import React from "react";
import "./HeaderNavBar.css";
import logoImage from "../../../../src/public/icons/logo.png";

export type Mode = "authenticated" | "unauthenticated";

export type NavItemKey = "home" | "feed" | "library";

export type HeaderNavBarProps = {
  mode: Mode;

  activeNavItem?: NavItemKey | null;

  searchValue: string;
  onSearchValueChange: (v: string) => void;
  onSearchSubmit: (q: string) => void;

  onLogoClick: () => void;
  onNavClick: (item: NavItemKey) => void;

  onSignInClick?: () => void;
  onCreateAccountClick?: () => void;

  onUploadClick?: () => void;
  onUserAccountClick?: () => void;
  onNotificationsClick?: () => void;
  onMoreActionsClick?: () => void;

  user?: {
    id: string;
    name?: string;
    avatarUrl?: string | null;
  };

  notificationsCount?: number;
};

const PRIMARY_NAV_ITEMS: Array<{ key: NavItemKey; label: string }> = [
  { key: "home", label: "Home" },
  { key: "feed", label: "Feed" },
  { key: "library", label: "Library" },
];

export const HeaderNavBar: React.FC<HeaderNavBarProps> = ({
  mode,
  activeNavItem = null,
  searchValue,
  onSearchValueChange,
  onSearchSubmit,
  onLogoClick,
  onNavClick,
  onSignInClick,
  onCreateAccountClick,
  onUploadClick,
  onUserAccountClick,
  onNotificationsClick,
  onMoreActionsClick,
  user,
  notificationsCount = 0,
}) => {
  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const query = searchValue.trim();
    if (!query) return;

    onSearchSubmit(query);
  };

  const userDisplayName = user?.name?.trim() || "Account";
  const userInitial = userDisplayName.charAt(0).toUpperCase();
  const visibleNotificationsCount = Math.max(0, notificationsCount);

  return (
    <header className="header-nav-bar" data-mode={mode}>
      <button
        type="button"
        className="header-nav-bar__logo"
        onClick={onLogoClick}
        aria-label="Go to home"
      >
        <img className="header-nav-bar__logo-image" src={logoImage} alt="" aria-hidden="true" />
      </button>

      <nav className="header-nav-bar__primary-nav" aria-label="Primary navigation">
        {PRIMARY_NAV_ITEMS.map((item) => {
          const isActive = activeNavItem === item.key;

          return (
            <button
              key={item.key}
              type="button"
              className={`header-nav-bar__nav-item${
                isActive ? " header-nav-bar__nav-item--active" : ""
              }`}
              onClick={() => onNavClick(item.key)}
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <form className="header-nav-bar__search" role="search" onSubmit={handleSearchSubmit}>
        <label className="header-nav-bar__search-label" htmlFor="header-nav-bar-search">
          Search
        </label>
        <input
          id="header-nav-bar-search"
          className="header-nav-bar__search-input"
          type="search"
          value={searchValue}
          onChange={(event) => onSearchValueChange(event.target.value)}
          placeholder="Search samples"
        />
        <button
          type="submit"
          className="header-nav-bar__search-submit"
          aria-label="Submit search"
        >
          <svg
            className="header-nav-bar__search-submit-icon"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="8.5" cy="8.5" r="4.75" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M12 12L16.25 16.25"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="square"
            />
          </svg>
        </button>
      </form>

      <div className="header-nav-bar__right-zone">
        {mode === "unauthenticated" ? (
          <>
            <button
              type="button"
              className="header-nav-bar__action header-nav-bar__action--secondary"
              onClick={onSignInClick}
            >
              Sign In
            </button>
            <button
              type="button"
              className="header-nav-bar__action header-nav-bar__action--primary"
              onClick={onCreateAccountClick}
            >
              Create Account
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="header-nav-bar__action header-nav-bar__action--primary"
              onClick={onUploadClick}
            >
              Upload
            </button>
            <button
              type="button"
              className="header-nav-bar__account"
              onClick={onUserAccountClick}
              aria-label={userDisplayName}
            >
              {user?.avatarUrl ? (
                <img
                  className="header-nav-bar__avatar"
                  src={user.avatarUrl}
                  alt=""
                  aria-hidden="true"
                />
              ) : (
                <span className="header-nav-bar__avatar-placeholder" aria-hidden="true">
                  {userInitial}
                </span>
              )}
              <span className="header-nav-bar__account-name">{userDisplayName}</span>
            </button>
            <button
              type="button"
              className="header-nav-bar__icon-action"
              onClick={onNotificationsClick}
              aria-label="Notifications"
            >
              Bell
              {visibleNotificationsCount > 0 && (
                <span className="header-nav-bar__notifications-count">
                  {visibleNotificationsCount > 99 ? "99+" : visibleNotificationsCount}
                </span>
              )}
            </button>
            <button
              type="button"
              className="header-nav-bar__icon-action"
              onClick={onMoreActionsClick}
              aria-label="More actions"
            >
              More
            </button>
          </>
        )}
      </div>
    </header>
  );
};

export default HeaderNavBar;
