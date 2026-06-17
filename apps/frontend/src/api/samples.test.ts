import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchSamples, fetchSampleById, listMockSampleIds } from "./samples";

const okJson = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as Response;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchSamples", () => {
  it("normalizes a successful backend response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      okJson({
        samples: [{ id: "x1", title: "Track" }],
        nextCursor: "next-1",
      }),
    );

    const result = await fetchSamples({ sort: "newest" });
    expect(result.samples).toHaveLength(1);
    expect(result.samples[0].id).toBe("x1");
    expect(result.nextCursor).toBe("next-1");
  });

  it("accepts alternative payload keys (items/data)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      okJson({ items: [{ id: "y1", title: "Item" }] }),
    );
    const result = await fetchSamples({});
    expect(result.samples[0].id).toBe("y1");
  });

  it("falls back to mock data when the backend is unavailable", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));
    const result = await fetchSamples({});
    expect(result.samples.length).toBeGreaterThan(0);
  });

  it("falls back to mock data on a non-ok response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);
    const result = await fetchSamples({});
    expect(result.samples.length).toBeGreaterThan(0);
  });
});

describe("fetchSampleById", () => {
  it("returns the backend detail payload when available", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      okJson({ id: "popular-1", title: "From backend" }),
    );
    const detail = await fetchSampleById("popular-1", { delayMs: 0 });
    expect(detail?.title).toBe("From backend");
  });

  it("returns null on a 404", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    } as Response);
    const detail = await fetchSampleById("missing", { delayMs: 0 });
    expect(detail).toBeNull();
  });

  it("falls back to mock detail when the backend errors", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("offline"));
    const id = listMockSampleIds()[0];
    const detail = await fetchSampleById(id, { delayMs: 0 });
    expect(detail?.id).toBe(id);
  });
});
