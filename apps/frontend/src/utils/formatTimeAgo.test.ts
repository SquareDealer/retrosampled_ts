import { describe, it, expect } from "vitest";
import { formatTimeAgo } from "./formatTimeAgo";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatTimeAgo", () => {
  it("returns 'just now' for very recent times and invalid input", () => {
    expect(formatTimeAgo(new Date())).toBe("just now");
    expect(formatTimeAgo("not-a-date")).toBe("just now");
  });

  it("formats minutes, hours and days with pluralization", () => {
    expect(formatTimeAgo(new Date(Date.now() - MINUTE))).toBe("1 minute ago");
    expect(formatTimeAgo(new Date(Date.now() - 5 * MINUTE))).toBe("5 minutes ago");
    expect(formatTimeAgo(new Date(Date.now() - HOUR))).toBe("1 hour ago");
    expect(formatTimeAgo(new Date(Date.now() - 3 * HOUR))).toBe("3 hours ago");
    expect(formatTimeAgo(new Date(Date.now() - DAY))).toBe("1 day ago");
    expect(formatTimeAgo(new Date(Date.now() - 10 * DAY))).toBe("10 days ago");
  });
});
