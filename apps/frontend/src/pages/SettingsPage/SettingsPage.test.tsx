import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@retrosampled/shared";
import { AuthContext, type AuthContextValue, type AuthStatus } from "../../auth/authContext";
import RequireAuth from "../../components/RequireAuth";
import * as users from "../../api/users";
import SettingsPage from "./SettingsPage";

const southkid: SessionUser = {
  sub: "u-1",
  id: "u-1",
  email: "southkid@example.com",
  username: "southkid",
  displayName: "South Kid",
  avatarUrl: null,
  role: "USER",
};

function authValue(user: SessionUser | null, status: AuthStatus): AuthContextValue {
  return {
    user,
    status,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    openAuthModal: vi.fn(),
    closeAuthModal: vi.fn(),
  } as unknown as AuthContextValue;
}

function renderSettings(user: SessionUser | null, status: AuthStatus) {
  return render(
    <AuthContext.Provider value={authValue(user, status)}>
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/" element={<p>home with modal</p>} />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <SettingsPage />
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("/settings behind RequireAuth", () => {
  it("redirects a guest to the login modal route", () => {
    renderSettings(null, "guest");

    expect(screen.queryByText("Settings")).toBeNull();
    expect(screen.getByText("home with modal")).not.toBeNull();
  });

  it("renders nothing while the session loads", () => {
    const { container } = renderSettings(null, "loading");

    expect(container.textContent).toBe("");
  });

  it("renders the settings form for a signed-in user", async () => {
    vi.spyOn(users, "fetchUser").mockResolvedValue({
      id: "u-1",
      username: "southkid",
      displayName: "South Kid",
      avatarUrl: null,
      bio: "Dusty loops.",
      links: { x: "https://x.com/southkid" },
      role: "USER",
      createdAt: "2026-01-01T00:00:00.000Z",
      stats: { followers: 1, following: 2, uploads: 3, remakes: 4, likesReceived: 5 },
      isFollowing: false,
      isMe: true,
    });

    renderSettings(southkid, "authenticated");

    expect(screen.getByRole("heading", { name: "Settings" })).not.toBeNull();
    expect(await screen.findByDisplayValue("Dusty loops.")).not.toBeNull();
    expect(screen.getByDisplayValue("https://x.com/southkid")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Delete my account" })).not.toBeNull();
  });
});
