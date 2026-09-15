import { API_URL } from "./config";

export const AUTH_EXPIRED_EVENT = "auth:expired";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type RequestOptions = {
  /** Skip the refresh-and-retry dance (used by the auth endpoints themselves). */
  skipAuthRefresh?: boolean;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/** One in-flight refresh at a time, shared by every caller that hits a 401. */
let refreshPromise: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function notifyAuthExpired() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message?: unknown }).message;
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;
  }

  if (typeof body === "string" && body) {
    return body;
  }

  return `Request failed with status ${status}`;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const send = () =>
    fetch(`${API_URL}${path}`, {
      method,
      credentials: "include",
      signal: options.signal,
      headers: {
        ...(isFormData || body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
        ...(options.headers ?? {}),
      },
      body: isFormData ? (body as FormData) : body === undefined ? undefined : JSON.stringify(body),
    });

  let response = await send();

  if (response.status === 401 && !options.skipAuthRefresh) {
    const refreshed = await refreshSession();

    if (refreshed) {
      response = await send();
    }

    if (!refreshed || response.status === 401) {
      notifyAuthExpired();
      const failedBody = await parseBody(response);
      throw new ApiError(401, errorMessage(failedBody, 401));
    }
  }

  const parsed = await parseBody(response);

  if (!response.ok) {
    throw new ApiError(response.status, errorMessage(parsed, response.status));
  }

  return parsed as T;
}

export const get = <T>(path: string, options?: RequestOptions) =>
  request<T>("GET", path, undefined, options);

export const post = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  request<T>("POST", path, body, options);

export const patch = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  request<T>("PATCH", path, body, options);

export const put = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  request<T>("PUT", path, body, options);

export const del = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  request<T>("DELETE", path, body, options);

export const postForm = <T>(
  path: string,
  form: FormData,
  options?: RequestOptions
) => request<T>("POST", path, form, options);
