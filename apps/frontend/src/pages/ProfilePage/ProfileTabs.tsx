import React from "react";
import type { ProfileTab } from "../../api/users";

type ProfileTabsProps = {
  active: ProfileTab;
  counts: Partial<Record<ProfileTab, number>>;
  onChange: (tab: ProfileTab) => void;
};

const PROFILE_TABS: Array<{ key: ProfileTab; label: string }> = [
  { key: "uploads", label: "Uploads" },
  { key: "remakes", label: "Remakes" },
  { key: "liked", label: "Liked" },
];

export const ProfileTabs: React.FC<ProfileTabsProps> = ({ active, counts, onChange }) => (
  <nav className="profile-tabs" aria-label="Profile tabs">
    {PROFILE_TABS.map((tab) => (
      <button
        key={tab.key}
        type="button"
        className={`profile-tabs__tab${active === tab.key ? " profile-tabs__tab--active" : ""}`}
        onClick={() => onChange(tab.key)}
        aria-current={active === tab.key ? "page" : undefined}
      >
        {tab.label}
        {counts[tab.key] !== undefined ? (
          <span className="profile-tabs__count">{counts[tab.key]}</span>
        ) : null}
      </button>
    ))}
  </nav>
);

export default ProfileTabs;
