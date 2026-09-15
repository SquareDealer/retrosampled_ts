import React, { useState } from "react";
import type { PublicUserDto } from "@retrosampled/shared";
import { ApiError, get } from "../../../api/http";
import type { CollaboratorRef } from "../useUploadWizard";
import { Icon, initialsOf } from "./icons";

type CollaboratorPickerProps = {
  collaborators: CollaboratorRef[];
  onChange: (collaborators: CollaboratorRef[]) => void;
  /** The signed-in user, shown as a fixed "you" chip. */
  viewer?: { id: string; username: string } | null;
  /** OG creator on remakes: credited automatically, shown as a fixed chip. */
  ogCreator?: { id: string; username: string } | null;
};

const Chip: React.FC<{
  username: string;
  avatarUrl?: string | null;
  badge?: string;
  onRemove?: () => void;
}> = ({ username, avatarUrl, badge, onRemove }) => (
  <span className="upload-uchip">
    {avatarUrl ? (
      <img className="upload-ava" src={avatarUrl} alt="" />
    ) : (
      <span className="upload-ava">{initialsOf(username)}</span>
    )}
    @{username}
    {badge ? <span className="upload-badge upload-badge--muted upload-badge--tiny">{badge}</span> : null}
    {onRemove ? (
      <button
        type="button"
        className="upload-chip__x"
        aria-label={`Remove collaborator ${username}`}
        onClick={onRemove}
      >
        <Icon.X />
      </button>
    ) : null}
  </span>
);

/**
 * Adds collaborators by exact username (`GET /users/:username`). Task 3.2's
 * search endpoint can replace the lookup with type-ahead later.
 */
export const CollaboratorPicker: React.FC<CollaboratorPickerProps> = ({
  collaborators,
  onChange,
  viewer,
  ogCreator,
}) => {
  const [draft, setDraft] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLooking, setIsLooking] = useState(false);

  const add = async () => {
    const username = draft.trim().replace(/^@/, "").toLowerCase();
    if (!username || isLooking) return;

    if (viewer && username === viewer.username.toLowerCase()) {
      setLookupError("that's you — you're credited already.");
      return;
    }
    if (collaborators.some((entry) => entry.username.toLowerCase() === username)) {
      setLookupError("already added.");
      return;
    }

    setIsLooking(true);
    setLookupError(null);

    try {
      const found = await get<PublicUserDto>(`/users/${encodeURIComponent(username)}`);
      onChange([...collaborators, { id: found.id, username: found.username }]);
      setDraft("");
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setLookupError(`no one called @${username} here.`);
      } else {
        setLookupError(error instanceof Error ? error.message : "lookup failed.");
      }
    } finally {
      setIsLooking(false);
    }
  };

  return (
    <div className="upload-field">
      <span className="upload-label">
        <span>collaborators</span>
        <small>they get the collab badge</small>
      </span>
      <div className="upload-chips">
        {ogCreator && ogCreator.id !== viewer?.id ? (
          <Chip username={ogCreator.username} badge="og" />
        ) : null}
        {viewer ? <Chip username={viewer.username} badge="you" /> : null}
        {collaborators.map((collaborator) => (
          <Chip
            key={collaborator.id}
            username={collaborator.username}
            onRemove={() =>
              onChange(collaborators.filter((entry) => entry.id !== collaborator.id))
            }
          />
        ))}
      </div>
      <div className="upload-collab-row">
        <input
          className={`upload-input${lookupError ? " upload-input--error" : ""}`}
          value={draft}
          placeholder="@username"
          aria-label="Collaborator username"
          onChange={(event) => {
            setDraft(event.target.value);
            setLookupError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void add();
            }
          }}
        />
        <button
          type="button"
          className="upload-btn"
          onClick={() => {
            void add();
          }}
          disabled={!draft.trim() || isLooking}
        >
          {isLooking ? "looking…" : "add"}
        </button>
      </div>
      {lookupError ? <span className="upload-error">{lookupError}</span> : null}
    </div>
  );
};
