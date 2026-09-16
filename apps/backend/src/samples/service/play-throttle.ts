/**
 * In-memory "one play per (ip, sample) per window" throttle for
 * `POST /samples/:id/plays`. Good enough for a single process; a shared cache
 * takes over when the API scales out.
 */
export class PlayThrottle {
  private readonly seen = new Map<string, number>();
  private lastSweep = 0;

  constructor(
    private readonly windowMs: number = 30_000,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Returns true when the play should be counted and records it. */
  allow(ip: string, sampleId: string): boolean {
    const timestamp = this.now();
    this.sweep(timestamp);

    const key = `${ip}|${sampleId}`;
    const previous = this.seen.get(key);

    if (previous !== undefined && timestamp - previous < this.windowMs) {
      return false;
    }

    this.seen.set(key, timestamp);
    return true;
  }

  private sweep(timestamp: number): void {
    if (timestamp - this.lastSweep < this.windowMs) {
      return;
    }

    this.lastSweep = timestamp;
    for (const [key, seenAt] of this.seen) {
      if (timestamp - seenAt >= this.windowMs) {
        this.seen.delete(key);
      }
    }
  }
}
