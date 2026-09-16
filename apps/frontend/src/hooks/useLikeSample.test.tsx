import React from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@retrosampled/shared";
import { AuthContext, type AuthContextValue, type AuthStatus } from "../auth/authContext";
import { useLikeSample } from "./useLikeSample";

vi.mock("../api/samples", () => ({
  toggleLike: vi.fn(),
}));

import { toggleLike } from "../api/samples";

const toggleLikeMock = vi.mocked(toggleLike);

const USER: SessionUser = {
  sub: "u1",
  id: "u1",
  email: "southkid@example.com",
  username: "southkid",
  displayName: null,
  avatarUrl: null,
  role: "USER",
};

function wrapperFor(status: AuthStatus, openAuthModal = vi.fn()) {
  const value = {
    user: status === "authenticated" ? USER : null,
    status,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    openAuthModal,
    closeAuthModal: vi.fn(),
  } as unknown as AuthContextValue;

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );

  return { Wrapper, openAuthModal };
}

describe("useLikeSample", () => {
  beforeEach(() => {
    toggleLikeMock.mockReset();
  });

  it("applies the like optimistically and adopts the server count", async () => {
    let resolve!: (value: { liked: boolean; likesCount: number }) => void;
    toggleLikeMock.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    );
    const { Wrapper } = wrapperFor("authenticated");

    const { result } = renderHook(() => useLikeSample("s1", { isLiked: false, likesCount: 4 }), {
      wrapper: Wrapper,
    });

    let pending: Promise<void>;
    act(() => {
      pending = result.current.toggle();
    });

    // Optimistic state is visible before the request settles.
    expect(result.current.isLiked).toBe(true);
    expect(result.current.likesCount).toBe(5);
    expect(result.current.isPending).toBe(true);

    await act(async () => {
      resolve({ liked: true, likesCount: 7 });
      await pending;
    });

    expect(toggleLikeMock).toHaveBeenCalledWith("s1", true);
    expect(result.current.likesCount).toBe(7);
    expect(result.current.isPending).toBe(false);
  });

  it("rolls back and reports when the request fails", async () => {
    toggleLikeMock.mockRejectedValue(new Error("Like request failed."));
    const onError = vi.fn();
    const { Wrapper } = wrapperFor("authenticated");

    const { result } = renderHook(
      () => useLikeSample("s1", { isLiked: true, likesCount: 3 }, { onError }),
      { wrapper: Wrapper }
    );

    await act(async () => {
      await result.current.toggle();
    });

    expect(result.current.isLiked).toBe(true);
    expect(result.current.likesCount).toBe(3);
    expect(onError).toHaveBeenCalledWith("Like request failed.");
  });

  it("sends guests to the login modal without calling the API", async () => {
    const { Wrapper, openAuthModal } = wrapperFor("guest");

    const { result } = renderHook(() => useLikeSample("s1", { isLiked: false, likesCount: 1 }), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.toggle();
    });

    expect(openAuthModal).toHaveBeenCalledWith("login");
    expect(toggleLikeMock).not.toHaveBeenCalled();
    expect(result.current.likesCount).toBe(1);
  });

  it("re-syncs when the sample changes", () => {
    const { Wrapper } = wrapperFor("authenticated");

    const { result, rerender } = renderHook(
      ({ id, count }: { id: string; count: number }) => useLikeSample(id, { likesCount: count }),
      { wrapper: Wrapper, initialProps: { id: "s1", count: 2 } }
    );

    expect(result.current.likesCount).toBe(2);
    rerender({ id: "s2", count: 9 });
    expect(result.current.likesCount).toBe(9);
  });
});
