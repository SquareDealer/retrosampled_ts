import { Transform } from 'class-transformer';

/**
 * Coerces `tags=a&tags=b`, `tags=a,b`, a JSON-encoded array or a single value
 * into a trimmed, de-duplicated `string[]`. Multipart bodies and query strings
 * both arrive as strings, so every array field needs this.
 */
export function toStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const raw: unknown[] = Array.isArray(value) ? value : [value];
  const out: string[] = [];

  for (const item of raw) {
    if (typeof item !== 'string') {
      continue;
    }

    const trimmed = item.trim();

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          out.push(...parsed.filter((entry): entry is string => typeof entry === 'string'));
          continue;
        }
      } catch {
        // not JSON, treat as a plain value
      }
    }

    out.push(...trimmed.split(','));
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of out) {
    const normalized = entry.trim();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }

  return result;
}

export const TransformStringArray = () =>
  Transform(({ value }) => toStringArray(value), { toClassOnly: true });

/** `""` and `"null"` (multipart cannot send null) become `null`; numbers are parsed. */
export const TransformNullableInt = () =>
  Transform(
    ({ value }) => {
      if (value === undefined) return undefined;
      if (value === null || value === '' || value === 'null') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : value;
    },
    { toClassOnly: true },
  );

export const TransformNullableString = () =>
  Transform(
    ({ value }) => {
      if (value === undefined) return undefined;
      if (value === null || value === 'null') return null;
      return typeof value === 'string' ? value.trim() : value;
    },
    { toClassOnly: true },
  );
