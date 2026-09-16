import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { can } from "@retrosampled/shared";
import type { SessionUser, UserRole } from "@retrosampled/shared";
import { AuthContext, type AuthContextValue, type AuthStatus } from "../auth/authContext";
import HeaderNavBar from "./HeaderNavBar";
import RequireRole from "./RequireRole";

function sessionUser(role: UserRole): SessionUser {
  return {
    sub: role === "ADMIN" ? "admin-1" : "user-1",
    id: role === "ADMIN" ? "admin-1" : "user-1",
    email: role === "ADMIN" ? "admin@example.com" : "southkid@example.com",
    username: role === "ADMIN" ? "admin" : "southkid",
    displayName: null,
    avatarUrl: null,
    role,
  };
}

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

function renderGate(user: SessionUser | null, status: AuthStatus) {
  return render(
    <AuthContext.Provider value={authValue(user, status)}>
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/" element={<p>home</p>} />
          <Route
            path="/admin"
            element={
              <RequireRole role="ADMIN" fallback="forbidden">
                <p>admin console</p>
              </RequireRole>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

const headerProps = {
  mode: "authenticated" as const,
  searchValue: "",
  onSearchValueChange: vi.fn(),
  onSearchSubmit: vi.fn(),
  onLogoClick: vi.fn(),
  onNavClick: vi.fn(),
};

function renderHeaderFor(user: SessionUser | null) {
  // Exactly what App.tsx computes for the header.
  const actor = user ? { id: user.id, role: user.role } : null;

  return render(
    <HeaderNavBar
      {...headerProps}
      showAdminLink={can(actor, "admin:any")}
      onAdminClick={vi.fn()}
      user={user ? { id: user.id, name: user.username } : undefined}
    />
  );
}

afterEach(() => {
  cleanup();
});

describe("can()-gated admin link in the header", () => {
  it("is hidden for a USER", () => {
    renderHeaderFor(sessionUser("USER"));

    expect(screen.queryByRole("button", { name: "Admin" })).toBeNull();
  });

  it("is hidden for a guest", () => {
    renderHeaderFor(null);

    expect(screen.queryByRole("button", { name: "Admin" })).toBeNull();
  });

  it("is shown for an ADMIN", () => {
    renderHeaderFor(sessionUser("ADMIN"));

    expect(screen.getByRole("button", { name: "Admin" })).not.toBeNull();
  });

  it("agrees with can() itself", () => {
    expect(can({ id: "user-1", role: "USER" }, "admin:any")).toBe(false);
    expect(can({ id: "admin-1", role: "ADMIN" }, "admin:any")).toBe(true);
    expect(can(null, "admin:any")).toBe(false);
  });
});

describe("<RequireRole>", () => {
  it("renders the children for a matching role", () => {
    renderGate(sessionUser("ADMIN"), "authenticated");

    expect(screen.getByText("admin console")).not.toBeNull();
  });

  it("renders a 403 for a signed-in user without the role", () => {
    renderGate(sessionUser("USER"), "authenticated");

    expect(screen.queryByText("admin console")).toBeNull();
    expect(screen.getByText("403")).not.toBeNull();
  });

  it("sends a guest to the login modal instead of a 403", () => {
    renderGate(null, "guest");

    expect(screen.queryByText("admin console")).toBeNull();
    expect(screen.queryByText("403")).toBeNull();
    expect(screen.getByText("home")).not.toBeNull();
  });

  it("renders nothing while the session is still loading", () => {
    const { container } = renderGate(null, "loading");

    expect(container.textContent).toBe("");
  });

  it("redirects instead of showing a 403 when asked to", () => {
    render(
      <AuthContext.Provider value={authValue(sessionUser("USER"), "authenticated")}>
        <MemoryRouter initialEntries={["/admin"]}>
          <Routes>
            <Route path="/" element={<p>home</p>} />
            <Route
              path="/admin"
              element={
                <RequireRole role="ADMIN">
                  <p>admin console</p>
                </RequireRole>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.queryByText("admin console")).toBeNull();
    expect(screen.getByText("home")).not.toBeNull();
  });
});
