import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as follows from "../api/follows";
import { useFollow } from "./useFollow";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useFollow", () => {
  it("flips optimistically and keeps the server answer", async () => {
    vi.spyOn(follows, "setFollowing").mockResolvedValue({ following: true, followersCount: 42 });

    const { result } = renderHook(() =>
      useFollow({ userId: "u-2", initialFollowing: false, initialFollowersCount: 41 })
    );

    expect(result.current.isFollowing).toBe(false);

    await act(async () => {
      await result.current.toggle();
    });

    expect(follows.setFollowing).toHaveBeenCalledWith("u-2", true);
    expect(result.current.isFollowing).toBe(true);
    expect(result.current.followersCount).toBe(42);
    expect(result.current.isPending).toBe(false);
  });

  it("rolls back the flag and the count when the request fails", async () => {
    let reject: (error: Error) => void = () => undefined;
    vi.spyOn(follows, "setFollowing").mockImplementation(
      () =>
        new Promise((_, rejectPromise) => {
          reject = rejectPromise;
        })
    );
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useFollow({ userId: "u-2", initialFollowing: true, initialFollowersCount: 10, onError })
    );

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.toggle();
    });

    // Optimistic state while the request is in flight.
    await waitFor(() => expect(result.current.isFollowing).toBe(false));
    expect(result.current.followersCount).toBe(9);
    expect(result.current.isPending).toBe(true);

    await act(async () => {
      reject(new Error("boom"));
      await pending;
    });

    expect(result.current.isFollowing).toBe(true);
    expect(result.current.followersCount).toBe(10);
    expect(result.current.isPending).toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("ignores a second toggle while one is pending", async () => {
    const spy = vi
      .spyOn(follows, "setFollowing")
      .mockImplementation(() => new Promise(() => undefined));

    const { result } = renderHook(() => useFollow({ userId: "u-2", initialFollowing: false }));

    act(() => {
      void result.current.toggle();
    });
    await waitFor(() => expect(result.current.isPending).toBe(true));
    act(() => {
      void result.current.toggle();
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
