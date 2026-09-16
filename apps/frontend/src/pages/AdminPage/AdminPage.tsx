import React, { useCallback, useEffect, useRef, useState } from "react";
import type { AdminUserDto, UserRole } from "@retrosampled/shared";
import { USER_ROLES, can } from "@retrosampled/shared";
import { ApiError } from "../../api/http";
import { fetchUsers, updateUser } from "../../api/admin";
import { useAuth } from "../../auth/useAuth";
import "./AdminPage.css";

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 250;

type RowState = { pending: boolean; error: string | null };

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toISOString().slice(0, 10).replace(/-/g, ".");
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}

/**
 * `/admin` — the moderation surface. The route is gated twice (RequireAuth +
 * RequireRole), and the backend gates it a third time with `@Roles('ADMIN')`;
 * this page only has to render.
 */
export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const actor = user ? { id: user.id, role: user.role } : null;

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, RowState>>({});

  const requestId = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedQuery(query.trim()),
      SEARCH_DEBOUNCE_MS
    );
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    fetchUsers({ limit: PAGE_SIZE, q: debouncedQuery || undefined })
      .then((response) => {
        if (requestId.current !== id) return;
        setUsers(response.users);
        setNextCursor(response.nextCursor);
      })
      .catch((cause: unknown) => {
        if (requestId.current !== id) return;
        setError(messageOf(cause));
      })
      .finally(() => {
        if (requestId.current === id) setLoading(false);
      });
  }, [debouncedQuery]);

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMore) return;

    setLoadingMore(true);
    fetchUsers({ limit: PAGE_SIZE, q: debouncedQuery || undefined, cursor: nextCursor })
      .then((response) => {
        setUsers((current) => [...current, ...response.users]);
        setNextCursor(response.nextCursor);
      })
      .catch((cause: unknown) => setError(messageOf(cause)))
      .finally(() => setLoadingMore(false));
  }, [debouncedQuery, loadingMore, nextCursor]);

  const mutate = useCallback(
    async (target: AdminUserDto, patchBody: { role?: UserRole; isActive?: boolean }) => {
      setRows((current) => ({
        ...current,
        [target.id]: { pending: true, error: null },
      }));

      try {
        const updated = await updateUser(target.id, patchBody);
        setUsers((current) =>
          current.map((row) => (row.id === updated.id ? updated : row))
        );
        setRows((current) => ({
          ...current,
          [target.id]: { pending: false, error: null },
        }));
      } catch (cause: unknown) {
        setRows((current) => ({
          ...current,
          [target.id]: { pending: false, error: messageOf(cause) },
        }));
      }
    },
    []
  );

  // Belt and braces: the route is already role-gated, but a page that can act on
  // every account should say out loud which permission it is relying on.
  if (!can(actor, "admin:any")) {
    return null;
  }

  return (
    <main className="admin-page">
      <header className="admin-page__header">
        <p className="admin-page__eyebrow">Moderation</p>
        <h1>Admin</h1>
        <p className="admin-page__lead">
          Accounts, roles and access. Changes take effect immediately;
          deactivating an account also revokes its sessions.
        </p>
      </header>

      <div className="admin-page__toolbar">
        <label className="admin-page__search">
          <span className="admin-page__search-label">Search accounts</span>
          <input
            className="admin-page__search-input"
            type="search"
            value={query}
            placeholder="email, username or display name"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <p className="admin-page__count">
          {users.length} {users.length === 1 ? "account" : "accounts"}
          {nextCursor ? "+" : ""}
        </p>
      </div>

      {error && (
        <p className="admin-page__error" role="alert">
          {error}
        </p>
      )}

      <div className="admin-page__table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">User</th>
              <th scope="col">Email</th>
              <th scope="col">Joined</th>
              <th scope="col">Role</th>
              <th scope="col">Active</th>
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 && (
              <tr>
                <td className="admin-table__empty" colSpan={5}>
                  Loading…
                </td>
              </tr>
            )}

            {!loading && users.length === 0 && (
              <tr>
                <td className="admin-table__empty" colSpan={5}>
                  No accounts match that search.
                </td>
              </tr>
            )}

            {users.map((row) => {
              const state = rows[row.id] ?? { pending: false, error: null };
              const isSelf = row.id === user?.id;

              return (
                <tr
                  key={row.id}
                  className={`admin-table__row${
                    row.isActive ? "" : " admin-table__row--inactive"
                  }`}
                >
                  <td>
                    <span className="admin-table__username">{row.username}</span>
                    {isSelf && <span className="admin-table__badge">you</span>}
                    {state.error && (
                      <span className="admin-table__row-error" role="alert">
                        {state.error}
                      </span>
                    )}
                  </td>
                  <td className="admin-table__email">{row.email}</td>
                  <td className="admin-table__date">{formatDate(row.createdAt)}</td>
                  <td>
                    <select
                      className="admin-table__select"
                      aria-label={`Role of ${row.username}`}
                      value={row.role}
                      disabled={state.pending || isSelf}
                      onChange={(event) =>
                        void mutate(row, { role: event.target.value as UserRole })
                      }
                    >
                      {USER_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`admin-table__toggle${
                        row.isActive ? " admin-table__toggle--on" : ""
                      }`}
                      aria-pressed={row.isActive}
                      aria-label={`${row.isActive ? "Deactivate" : "Activate"} ${
                        row.username
                      }`}
                      disabled={state.pending || isSelf}
                      onClick={() => void mutate(row, { isActive: !row.isActive })}
                    >
                      {row.isActive ? "Active" : "Disabled"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <button
          type="button"
          className="admin-page__more"
          onClick={loadMore}
          disabled={loadingMore}
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </main>
  );
};

export default AdminPage;
