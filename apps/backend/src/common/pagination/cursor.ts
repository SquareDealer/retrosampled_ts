import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';

/**
 * Keyset cursor shared by every paginated list (library, followers,
 * notifications, comments).
 *
 * The encoded payload is `{ k, id, h }`:
 * - `k`  — the sort key of the last item on the page (a number for timestamps
 *          and counters, a string for lexical keys);
 * - `id` — the row id, used as the stable tie-breaker;
 * - `h`  — a short hash of the *facets* (tab, sort, filters, search) the page
 *          was produced under. A cursor handed back with different facets is
 *          rejected with `400 INVALID_QUERY`, exactly as the library spec asks.
 *
 * The cursor is opaque to clients: base64url of the JSON payload.
 */
export type CursorKey = number | string;

export type CursorPayload = {
  k: CursorKey;
  id: string;
};

type EncodedCursor = CursorPayload & { h: string };

const HASH_LENGTH = 12;

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

/** Hashes the facets a page was produced under; `undefined` values are ignored. */
export function facetHash(facets: Record<string, unknown>): string {
  return createHash('sha256')
    .update(stableStringify(facets))
    .digest('hex')
    .slice(0, HASH_LENGTH);
}

export function encodeCursor(payload: CursorPayload, hash: string): string {
  const encoded: EncodedCursor = { k: payload.k, id: payload.id, h: hash };

  return Buffer.from(JSON.stringify(encoded), 'utf8').toString('base64url');
}

function invalid(): never {
  throw new BadRequestException('INVALID_QUERY');
}

/**
 * Decodes a cursor and verifies it was produced under the same facets.
 * Any malformed cursor, and a valid one whose hash does not match, is a 400.
 */
export function decodeCursor(cursor: string, expectedHash: string): CursorPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    invalid();
  }

  if (!parsed || typeof parsed !== 'object') {
    invalid();
  }

  const { k, id, h } = parsed as Partial<EncodedCursor>;

  if (
    (typeof k !== 'number' && typeof k !== 'string') ||
    typeof id !== 'string' ||
    id.length === 0 ||
    typeof h !== 'string'
  ) {
    invalid();
  }

  if (h !== expectedHash) {
    invalid();
  }

  return { k: k as CursorKey, id: id as string };
}

/** Decodes when a cursor is present, otherwise `null` (first page). */
export function decodeOptionalCursor(
  cursor: string | undefined,
  expectedHash: string,
): CursorPayload | null {
  return cursor ? decodeCursor(cursor, expectedHash) : null;
}

/**
 * Compares two (key, id) pairs in *descending* order: newest / largest first,
 * ties broken by id descending so the order is total and stable.
 */
export function compareDesc(
  left: CursorPayload,
  right: CursorPayload,
): number {
  if (left.k !== right.k) {
    if (typeof left.k === 'number' && typeof right.k === 'number') {
      return right.k - left.k;
    }
    return String(right.k) < String(left.k) ? -1 : 1;
  }

  if (left.id === right.id) {
    return 0;
  }

  return right.id < left.id ? -1 : 1;
}

/**
 * Applies a decoded cursor to an in-memory list already sorted with
 * {@link compareDesc}: keeps the items strictly after the cursor position.
 */
export function afterCursor<T extends CursorPayload>(
  items: T[],
  cursor: CursorPayload | null,
): T[] {
  if (!cursor) {
    return items;
  }

  return items.filter((item) => compareDesc(item, cursor) > 0);
}

/**
 * Takes one page out of a sorted list and produces the `nextCursor` for it.
 * `null` when the list is exhausted.
 */
export function takePage<T extends CursorPayload>(
  items: T[],
  limit: number,
  hash: string,
): { page: T[]; nextCursor: string | null } {
  const page = items.slice(0, limit);
  const hasMore = items.length > limit;
  const last = page[page.length - 1];

  return {
    page,
    nextCursor: hasMore && last ? encodeCursor({ k: last.k, id: last.id }, hash) : null,
  };
}
