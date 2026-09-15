import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicUserDto, SessionUser } from "@retrosampled/shared";
import { AuthContext, type AuthContextValue, type AuthStatus } from "../../auth/authContext";
import * as http from "../../api/http";
import ProfilePage from "./ProfilePage";

vi.mock("../../components/AudioContextManager", () => ({
  useAudioContextManager: () => ({
    currentSample: null,
    state: { isPlaying: false, isReady: false },
    play: vi.fn(),
    seekTo: vi.fn(),
  }),
}));

const baga: PublicUserDto = {
  id: "u-2",
  username: "bagamemphis",
  displayName: "Baga Memphis",
  avatarUrl: null,
  bio: "Memphis tape worship.",
  links: { soundcloud: "https://soundcloud.com/baga" },
  role: "USER",
  createdAt: "2026-01-01T00:00:00.000Z",
  stats: { followers: 12, following: 3, uploads: 7, remakes: 2, likesReceived: 99 },
  isFollowing: false,
  isMe: false,
};

const southkid: SessionUser = {
  sub: "u-1",
  id: "u-1",
  email: "southkid@example.com",
  username: "southkid",
  displayName: null,
  avatarUrl: null,
  role: "USER",
};

function authValue(user: SessionUser | null, status: AuthStatus, openAuthModal = vi.fn()) {
  return {
    user,
    status,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    openAuthModal,
    closeAuthModal: vi.fn(),
  } as unknown as AuthContextValue;
}

function mockHttp(profile: PublicUserDto) {
  const get = vi.spyOn(http, "get").mockImplementation(async (path: string) => {
    if (path.startsWith("/users/")) return profile as never;
    if (path.startsWith("/samples?")) return { samples: [], nextCursor: null } as never;
    throw new http.ApiError(404, `unexpected ${path}`);
  });
  const post = vi.spyOn(http, "post").mockResolvedValue({ following: true, followersCount: 13 } as never);
  const del = vi.spyOn(http, "del").mockResolvedValue({ following: false, followersCount: 12 } as never);
  return { get, post, del };
}

function renderProfile(user: SessionUser | null, status: AuthStatus, openAuthModal = vi.fn()) {
  return render(
    <AuthContext.Provider value={authValue(user, status, openAuthModal)}>
      <MemoryRouter initialEntries={["/user/bagamemphis?tab=liked"]}>
        <Routes>
          <Route path="/user/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("<ProfilePage>", () => {
  it("renders the stats and a Follow button for another user", async () => {
    const { get } = mockHttp(baga);
    renderProfile(southkid, "authenticated");

    expect(await screen.findByRole("heading", { name: "Baga Memphis" })).not.toBeNull();
    expect(get).toHaveBeenCalledWith("/users/bagamemphis");

    const stats = screen.getByLabelText("Profile stats");
    expect(stats.textContent).toContain("12 followers");
    expect(stats.textContent).toContain("3 following");
    expect(stats.textContent).toContain("7 uploads");
    expect(stats.textContent).toContain("2 remakes");
    expect(stats.textContent).toContain("99 likes");

    expect(screen.getByRole("button", { name: "Follow @bagamemphis" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Liked" }).getAttribute("aria-current")).toBe("page");
    expect(await screen.findByText("No liked samples yet.")).not.toBeNull();
  });

  it("follows optimistically and updates the follower count", async () => {
    const { post } = mockHttp(baga);
    renderProfile(southkid, "authenticated");

    const button = await screen.findByRole("button", { name: "Follow @bagamemphis" });
    fireEvent.click(button);

    await waitFor(() => expect(post).toHaveBeenCalledWith("/users/u-2/follow"));
    await screen.findByRole("button", { name: "Unfollow @bagamemphis" });
    expect(screen.getByLabelText("Profile stats").textContent).toContain("13 followers");
  });

  it("shows Following when already followed", async () => {
    mockHttp({ ...baga, isFollowing: true });
    renderProfile(southkid, "authenticated");

    const button = await screen.findByRole("button", { name: "Unfollow @bagamemphis" });
    expect(button.textContent).toBe("Following");
  });

  it("shows Edit profile instead of Follow on your own profile", async () => {
    mockHttp({ ...baga, isMe: true });
    renderProfile({ ...southkid, id: "u-2", username: "bagamemphis" }, "authenticated");

    expect(await screen.findByRole("link", { name: "Edit profile" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Follow @/ })).toBeNull();
  });

  it("opens the auth modal for a guest instead of following", async () => {
    const { post } = mockHttp(baga);
    const openAuthModal = vi.fn();
    renderProfile(null, "guest", openAuthModal);

    fireEvent.click(await screen.findByRole("button", { name: "Follow @bagamemphis" }));

    expect(openAuthModal).toHaveBeenCalledWith("login");
    expect(post).not.toHaveBeenCalled();
  });

  it("renders a 404 state for an unknown user", async () => {
    vi.spyOn(http, "get").mockRejectedValue(new http.ApiError(404, "User not found"));
    renderProfile(null, "guest");

    expect(await screen.findByText("@bagamemphis does not exist")).not.toBeNull();
  });
});
