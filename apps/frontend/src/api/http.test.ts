import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_URL } from "./config";
import { ApiError, AUTH_EXPIRED_EVENT, get } from "./http";

type FetchMock = ReturnType<typeof vi.fn>;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function mockFetch(): FetchMock {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("http", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the parsed body on success", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));

    await expect(get<{ ok: boolean }>("/ping")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/ping`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: "include" });
  });

  it("refreshes once on 401 and retries the request", async () => {
    const fetchMock = mockFetch();
    fetchMock
      .mockResolvedValueOnce(json(401, { message: "Missing access token" }))
      .mockResolvedValueOnce(json(200, { message: "Session refreshed" }))
      .mockResolvedValueOnce(json(200, { user: { username: "southkid" } }));

    await expect(get("/auth/me")).resolves.toEqual({
      user: { username: "southkid" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe(`${API_URL}/auth/refresh`);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST" });
    expect(fetchMock.mock.calls[2][0]).toBe(`${API_URL}/auth/me`);
  });

  it("retries only once and then gives up with auth:expired", async () => {
    const fetchMock = mockFetch();
    fetchMock
      .mockResolvedValueOnce(json(401, { message: "Missing access token" }))
      .mockResolvedValueOnce(json(200, { message: "Session refreshed" }))
      .mockResolvedValueOnce(json(401, { message: "Missing access token" }));

    const onExpired = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);

    await expect(get("/auth/me")).rejects.toBeInstanceOf(ApiError);

    window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("does not retry when the refresh itself fails", async () => {
    const fetchMock = mockFetch();
    fetchMock
      .mockResolvedValueOnce(json(401, { message: "Missing access token" }))
      .mockResolvedValueOnce(json(401, { message: "No refresh token" }));

    await expect(get("/auth/me")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("dedupes concurrent refreshes into a single call", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/auth/refresh")) {
        return json(200, { message: "Session refreshed" });
      }
      return fetchMock.mock.calls.filter(
        (call: unknown[]) => call[0] === url
      ).length > 1
        ? json(200, { ok: true })
        : json(401, { message: "Missing access token" });
    });

    await Promise.all([get("/a"), get("/b")]);

    const refreshCalls = fetchMock.mock.calls.filter((call: unknown[]) =>
      String(call[0]).endsWith("/auth/refresh")
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it("throws an ApiError carrying the server message", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(
      json(409, { message: "Username already taken" })
    );

    await expect(get("/users/me")).rejects.toMatchObject({
      status: 409,
      message: "Username already taken",
    });
  });
});
