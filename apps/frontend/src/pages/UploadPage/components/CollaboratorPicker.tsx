import React, { useEffect, useRef, useState } from "react";
import type { UserListItem } from "@retrosampled/shared";
import { searchUsers } from "../../../api/users";
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

const SEARCH_DEBOUNCE_MS = 200;
const SEARCH_LIMIT = 6;

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
 * Type-ahead over `GET /users/search?q=`. Enter (or "add") takes the exact
 * username match when there is one, otherwise the first suggestion.
 */
export const CollaboratorPicker: React.FC<CollaboratorPickerProps> = ({
  collaborators,
  onChange,
  viewer,
  ogCreator,
}) => {
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<UserListItem[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLooking, setIsLooking] = useState(false);
  const requestIdRef = useRef(0);

  const query = draft.trim().replace(/^@/, "").toLowerCase();

  const excludedIds = new Set<string>([
    ...(viewer ? [viewer.id] : []),
    ...(ogCreator ? [ogCreator.id] : []),
    ...collaborators.map((entry) => entry.id),
  ]);

  useEffect(() => {
    if (!query) {
      setSuggestions([]);
      setIsLooking(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLooking(true);

    const timer = window.setTimeout(async () => {
      try {
        const response = await searchUsers(query, SEARCH_LIMIT);
        if (requestId !== requestIdRef.current) return;
        setSuggestions(response.users);
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        setSuggestions([]);
        setLookupError(error instanceof Error ? error.message : "lookup failed.");
      } finally {
        if (requestId === requestIdRef.current) setIsLooking(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query]);

  const visibleSuggestions = suggestions.filter((user) => !excludedIds.has(user.id));

  const add = (user: Pick<UserListItem, "id" | "username">) => {
    if (viewer && user.id === viewer.id) {
      setLookupError("that's you — you're credited already.");
      return;
    }
    if (collaborators.some((entry) => entry.id === user.id)) {
      setLookupError("already added.");
      return;
    }

    onChange([...collaborators, { id: user.id, username: user.username }]);
    setDraft("");
    setSuggestions([]);
    setLookupError(null);
  };

  const addFromDraft = () => {
    if (!query) return;

    if (viewer && query === viewer.username.toLowerCase()) {
      setLookupError("that's you — you're credited already.");
      return;
    }
    if (collaborators.some((entry) => entry.username.toLowerCase() === query)) {
      setLookupError("already added.");
      return;
    }

    const exact = suggestions.find((user) => user.username.toLowerCase() === query);
    const pick = exact ?? visibleSuggestions[0];

    if (!pick) {
      setLookupError(isLooking ? "still looking…" : `no one called @${query} here.`);
      return;
    }

    add(pick);
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
          aria-autocomplete="list"
          aria-controls="upload-collab-suggestions"
          autoComplete="off"
          onChange={(event) => {
            setDraft(event.target.value);
            setLookupError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addFromDraft();
            }
          }}
        />
        <button
          type="button"
          className="upload-btn"
          onClick={addFromDraft}
          disabled={!query || isLooking}
        >
          {isLooking ? "looking…" : "add"}
        </button>
      </div>
      {query && visibleSuggestions.length > 0 ? (
        <ul id="upload-collab-suggestions" className="upload-collab-suggestions" role="listbox">
          {visibleSuggestions.map((user) => (
            <li key={user.id} role="option" aria-selected={false}>
              <button
                type="button"
                className="upload-collab-suggestion"
                onClick={() => add(user)}
              >
                {user.avatarUrl ? (
                  <img className="upload-ava" src={user.avatarUrl} alt="" />
                ) : (
                  <span className="upload-ava">{initialsOf(user.username)}</span>
                )}
                <span className="upload-collab-suggestion__name">@{user.username}</span>
                {user.displayName ? (
                  <span className="upload-collab-suggestion__display">{user.displayName}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {query && !isLooking && visibleSuggestions.length === 0 && !lookupError ? (
        <span className="upload-hint">no one called @{query} here.</span>
      ) : null}
      {lookupError ? <span className="upload-error">{lookupError}</span> : null}
    </div>
  );
};
