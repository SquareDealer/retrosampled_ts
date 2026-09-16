/** Single source of truth for the backend origin. */
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

/** Set `VITE_USE_MOCKS=true` to keep the in-memory mock engines (Tasks 3.1a/3.2). */
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";
