import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PublicUserDto } from "@retrosampled/shared";
import { changePassword } from "../../api/auth";
import { ApiError } from "../../api/http";
import { deleteAccount, fetchUser, removeAvatar, updateMe, uploadAvatar } from "../../api/users";
import { useAuth } from "../../auth/useAuth";
import { useToast } from "../../hooks/useToast";
import Avatar from "../ProfilePage/Avatar";
import "../social.css";
import "./SettingsPage.css";

const LINK_FIELDS: Array<{ key: string; label: string; placeholder: string }> = [
  { key: "x", label: "X", placeholder: "https://x.com/you" },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/you" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@you" },
  { key: "soundcloud", label: "SoundCloud", placeholder: "https://soundcloud.com/you" },
  { key: "website", label: "Website", placeholder: "https://you.example" },
];

const USERNAME_PATTERN = /^[a-z0-9_]{1,16}$/i;
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const messageOf = (error: unknown, fallback: string) =>
  error instanceof ApiError || error instanceof Error ? error.message : fallback;

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUser, logout } = useAuth();
  const { toast, showToast } = useToast();

  const [profile, setProfile] = useState<PublicUserDto | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [links, setLinks] = useState<Record<string, string>>({});
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordOk, setPasswordOk] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    fetchUser(user.username)
      .then((loaded) => {
        if (cancelled) return;
        setProfile(loaded);
        setUsername(loaded.username);
        setDisplayName(loaded.displayName ?? "");
        setBio(loaded.bio ?? "");
        setLinks(loaded.links);
        setAvatarUrl(loaded.avatarUrl);
      })
      .catch((error: unknown) => {
        if (!cancelled) setProfileError(messageOf(error, "Could not load your profile."));
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError(null);

    const trimmedUsername = username.trim();
    if (!USERNAME_PATTERN.test(trimmedUsername)) {
      setProfileError("Username: 1–16 letters, digits or underscores.");
      return;
    }

    const cleanLinks: Record<string, string> = {};
    for (const [key, value] of Object.entries(links)) {
      if (value.trim()) cleanLinks[key] = value.trim();
    }

    setSavingProfile(true);
    try {
      const updated = await updateMe({
        username: trimmedUsername,
        displayName: displayName.trim(),
        bio: bio.trim(),
        links: cleanLinks,
      });
      setProfile(updated);
      setUsername(updated.username);
      await refreshUser();
      showToast("success", "Profile saved.");
    } catch (error) {
      setProfileError(messageOf(error, "Could not save the profile."));
    } finally {
      setSavingProfile(false);
    }
  };

  const onAvatarFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      showToast("error", "Avatar must be a PNG, JPEG or WebP image.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      showToast("error", "Avatar must be 2 MB or smaller.");
      return;
    }

    setAvatarBusy(true);
    try {
      const response = await uploadAvatar(file);
      setAvatarUrl(response.avatarUrl);
      await refreshUser();
      showToast("success", "Avatar updated.");
    } catch (error) {
      showToast("error", messageOf(error, "Could not upload the avatar."));
    } finally {
      setAvatarBusy(false);
    }
  };

  const onRemoveAvatar = async () => {
    setAvatarBusy(true);
    try {
      await removeAvatar();
      setAvatarUrl(null);
      await refreshUser();
      showToast("success", "Avatar removed.");
    } catch (error) {
      showToast("error", messageOf(error, "Could not remove the avatar."));
    } finally {
      setAvatarBusy(false);
    }
  };

  const savePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordOk(false);

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword(oldPassword, newPassword);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordOk(true);
      showToast("success", "Password changed.");
    } catch (error) {
      setPasswordError(messageOf(error, "Could not change the password."));
    } finally {
      setSavingPassword(false);
    }
  };

  const onDeleteAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDeleteError(null);

    if (!deleteConfirmed) {
      setDeleteError("Tick the confirmation first.");
      return;
    }

    setDeleting(true);
    try {
      await deleteAccount(deletePassword);
      await logout();
      navigate("/feed", { replace: true });
    } catch (error) {
      setDeleteError(messageOf(error, "Could not delete the account."));
      setDeleting(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <main className="social-page">
      <p className="social-eyebrow">Account</p>
      <h1 className="social-title">Settings</h1>
      <p className="social-subtitle">Signed in as {user.email}.</p>

      <div className="settings-grid">
        <section className="settings-card settings-card--wide" aria-labelledby="settings-profile">
          <h2 id="settings-profile">Profile</h2>

          <div className="settings-avatar">
            <Avatar src={avatarUrl} username={profile?.username ?? user.username} />
            <div className="settings-avatar__actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(event) => void onAvatarFile(event)}
                aria-label="Choose avatar"
              />
              <button
                type="button"
                className="social-btn"
                disabled={avatarBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                Upload avatar
              </button>
              <button
                type="button"
                className="social-btn"
                disabled={avatarBusy || !avatarUrl}
                onClick={() => void onRemoveAvatar()}
              >
                Remove
              </button>
              <span className="social-field__hint">PNG, JPEG or WebP, up to 2 MB.</span>
            </div>
          </div>

          <form className="social-form" onSubmit={(event) => void saveProfile(event)}>
            <label className="social-field">
              <span>Username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                maxLength={16}
                autoComplete="username"
                required
              />
              <span className="social-field__hint">Up to 16 characters. Your profile lives at /user/{username || "…"}.</span>
            </label>

            <label className="social-field">
              <span>Display name</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={60}
                autoComplete="name"
              />
            </label>

            <label className="social-field">
              <span>Bio</span>
              <textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={500} />
              <span className="social-field__hint">{bio.length}/500</span>
            </label>

            <div className="settings-links">
              {LINK_FIELDS.map((field) => (
                <label className="social-field" key={field.key}>
                  <span>{field.label}</span>
                  <input
                    value={links[field.key] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(event) =>
                      setLinks((current) => ({ ...current, [field.key]: event.target.value }))
                    }
                    inputMode="url"
                  />
                </label>
              ))}
            </div>

            {profileError ? <p className="social-error">{profileError}</p> : null}

            <div className="settings-actions">
              <button type="submit" className="social-btn social-btn--primary" disabled={savingProfile}>
                {savingProfile ? "Saving…" : "Save profile"}
              </button>
            </div>
          </form>
        </section>

        <section className="settings-card" aria-labelledby="settings-password">
          <h2 id="settings-password">Change password</h2>
          <p>Other sessions are signed out after a change.</p>
          <form className="social-form" onSubmit={(event) => void savePassword(event)}>
            <label className="social-field">
              <span>Current password</span>
              <input
                type="password"
                value={oldPassword}
                onChange={(event) => setOldPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <label className="social-field">
              <span>New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
            <label className="social-field">
              <span>Repeat new password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
            {passwordError ? <p className="social-error">{passwordError}</p> : null}
            {passwordOk ? <p className="social-ok">Password changed.</p> : null}
            <div className="settings-actions">
              <button type="submit" className="social-btn" disabled={savingPassword}>
                {savingPassword ? "Saving…" : "Change password"}
              </button>
            </div>
          </form>
        </section>

        <section className="settings-card settings-card--danger" aria-labelledby="settings-delete">
          <h2 id="settings-delete">Delete account</h2>
          <p>Your profile disappears and you are signed out. This cannot be undone.</p>
          <form className="social-form" onSubmit={(event) => void onDeleteAccount(event)}>
            <label className="social-field">
              <span>Password</span>
              <input
                type="password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <label className="settings-confirm">
              <input
                type="checkbox"
                checked={deleteConfirmed}
                onChange={(event) => setDeleteConfirmed(event.target.checked)}
              />
              I understand this deletes @{user.username} permanently.
            </label>
            {deleteError ? <p className="social-error">{deleteError}</p> : null}
            <div className="settings-actions">
              <button
                type="submit"
                className="social-btn social-btn--danger"
                disabled={deleting || !deleteConfirmed}
              >
                {deleting ? "Deleting…" : "Delete my account"}
              </button>
            </div>
          </form>
        </section>
      </div>

      {toast ? (
        <div className={`page-toast page-toast--${toast.tone}`} role="status" aria-live="polite">
          {toast.text}
        </div>
      ) : null}
    </main>
  );
};

export default SettingsPage;
