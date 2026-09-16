import React, { useEffect, useRef, useState } from "react";
import "./HeaderNavBar.css";
import logoImage from "../../../../src/public/icons/logo.png";
import { UNREAD_CHANGED_EVENT, fetchUnreadCount } from "../api/notifications";
import { resolveAvatarUrl } from "../api/users";

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
  /** Account menu → "Profile". */
  onUserAccountClick?: () => void;
  /** Task 2: rendered only when `can(user, "admin:any")` — see App.tsx. */
  showAdminLink?: boolean;
  onAdminClick?: () => void;
  onNotificationsClick?: () => void;
  /** Account menu → "Settings". */
  onSettingsClick?: () => void;
  /** Account menu → "Log out". */
  onLogoutClick?: () => void;

  user?: {
    id: string;
    name?: string;
    avatarUrl?: string | null;
  };

  /**
   * Initial badge value. While `mode === "authenticated"` the header keeps it
   * fresh itself: `/notifications/unread-count` every 30 s plus the
   * `UNREAD_CHANGED_EVENT` the notifications page emits.
   */
  notificationsCount?: number;
};

const PRIMARY_NAV_ITEMS: Array<{ key: NavItemKey; label: string }> = [
  { key: "home", label: "Home" },
  { key: "feed", label: "Feed" },
  { key: "library", label: "Library" },
];

const UNREAD_POLL_MS = 30_000;

function useUnreadBadge(enabled: boolean, initial: number): number {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }

    let active = true;

    const poll = () => {
      fetchUnreadCount()
        .then((response) => {
          if (active) setCount(response.unreadCount);
        })
        .catch(() => {
          /* keep the last known value */
        });
    };

    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ unreadCount: number }>).detail;
      if (detail && typeof detail.unreadCount === "number") setCount(detail.unreadCount);
    };

    poll();
    const timer = window.setInterval(poll, UNREAD_POLL_MS);
    window.addEventListener(UNREAD_CHANGED_EVENT, onChanged);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(UNREAD_CHANGED_EVENT, onChanged);
    };
  }, [enabled]);

  return enabled ? count : 0;
}

const BellIcon: React.FC = () => (
  <svg
    className="header-nav-bar__icon"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M10 2.5a4.5 4.5 0 0 0-4.5 4.5v2.8L4 12.5v1h12v-1l-1.5-2.7V7A4.5 4.5 0 0 0 10 2.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="M8 15.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
  </svg>
);

const ChevronIcon: React.FC = () => (
  <svg className="header-nav-bar__chevron" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
  </svg>
);

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
  showAdminLink = false,
  onAdminClick,
  onNotificationsClick,
  onSettingsClick,
  onLogoutClick,
  user,
  notificationsCount = 0,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const unreadCount = useUnreadBadge(mode === "authenticated", notificationsCount);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (mode !== "authenticated") setMenuOpen(false);
  }, [mode]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const query = searchValue.trim();
    if (!query) return;

    onSearchSubmit(query);
  };

  const userDisplayName = user?.name?.trim() || "Account";
  const userInitial = userDisplayName.charAt(0).toUpperCase();
  const avatarUrl = resolveAvatarUrl(user?.avatarUrl);
  const badge = unreadCount > 99 ? "99+" : String(unreadCount);

  const runMenuAction = (action?: () => void) => {
    setMenuOpen(false);
    action?.();
  };

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

        {showAdminLink && (
          <button
            type="button"
            className="header-nav-bar__nav-item header-nav-bar__nav-item--admin"
            onClick={onAdminClick}
          >
            Admin
          </button>
        )}
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
              className="header-nav-bar__icon-action"
              onClick={onNotificationsClick}
              aria-label={
                unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
              }
            >
              <BellIcon />
              {unreadCount > 0 && (
                <span className="header-nav-bar__notifications-count" data-testid="unread-badge">
                  {badge}
                </span>
              )}
            </button>

            <div className="header-nav-bar__account-wrap" ref={menuRef}>
              <button
                type="button"
                className="header-nav-bar__account"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label={`${userDisplayName} account menu`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                {avatarUrl ? (
                  <img className="header-nav-bar__avatar" src={avatarUrl} alt="" aria-hidden="true" />
                ) : (
                  <span className="header-nav-bar__avatar-placeholder" aria-hidden="true">
                    {userInitial}
                  </span>
                )}
                <span className="header-nav-bar__account-name">{userDisplayName}</span>
                <ChevronIcon />
              </button>

              {menuOpen && (
                <div className="header-nav-bar__menu" role="menu" aria-label="Account">
                  <button
                    type="button"
                    role="menuitem"
                    className="header-nav-bar__menu-item"
                    onClick={() => runMenuAction(onUserAccountClick)}
                  >
                    Profile
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="header-nav-bar__menu-item"
                    onClick={() => runMenuAction(onSettingsClick)}
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="header-nav-bar__menu-item header-nav-bar__menu-item--muted"
                    onClick={() => runMenuAction(onLogoutClick)}
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
};

export default HeaderNavBar;
