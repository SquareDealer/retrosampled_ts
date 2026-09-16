import { BadRequestException } from '@nestjs/common';
import {
  afterCursor,
  compareDesc,
  decodeCursor,
  encodeCursor,
  facetHash,
  takePage,
} from './cursor';

describe('cursor', () => {
  const hash = facetHash({ tab: 'liked', sort: 'newest' });

  it('round-trips a numeric key', () => {
    const cursor = encodeCursor({ k: 1700000000000, id: 'abc' }, hash);

    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(cursor, hash)).toEqual({ k: 1700000000000, id: 'abc' });
  });

  it('round-trips a string key', () => {
    const cursor = encodeCursor({ k: 'lo-fi', id: 'x' }, hash);

    expect(decodeCursor(cursor, hash)).toEqual({ k: 'lo-fi', id: 'x' });
  });

  it('rejects a cursor produced under different facets', () => {
    const cursor = encodeCursor({ k: 1, id: 'a' }, hash);
    const otherHash = facetHash({ tab: 'liked', sort: 'most-popular' });

    expect(() => decodeCursor(cursor, otherHash)).toThrow(BadRequestException);
    expect(() => decodeCursor(cursor, otherHash)).toThrow('INVALID_QUERY');
  });

  it('rejects garbage', () => {
    expect(() => decodeCursor('not-base64-json', hash)).toThrow(BadRequestException);
    expect(() =>
      decodeCursor(Buffer.from('{"k":1}').toString('base64url'), hash),
    ).toThrow(BadRequestException);
  });

  it('hashes facets independently of key order and undefined values', () => {
    expect(facetHash({ a: 1, b: 'x', c: undefined })).toBe(facetHash({ b: 'x', a: 1 }));
    expect(facetHash({ a: 1 })).not.toBe(facetHash({ a: 2 }));
  });

  it('orders descending by key then id', () => {
    expect(compareDesc({ k: 2, id: 'a' }, { k: 1, id: 'z' })).toBeLessThan(0);
    expect(compareDesc({ k: 1, id: 'b' }, { k: 1, id: 'a' })).toBeLessThan(0);
    expect(compareDesc({ k: 1, id: 'a' }, { k: 1, id: 'a' })).toBe(0);
  });

  it('pages a sorted list and continues after the cursor', () => {
    const items = [
      { k: 5, id: 'e' },
      { k: 4, id: 'd' },
      { k: 4, id: 'c' },
      { k: 3, id: 'b' },
      { k: 1, id: 'a' },
    ];

    const first = takePage(items, 2, hash);
    expect(first.page.map((item) => item.id)).toEqual(['e', 'd']);
    expect(first.nextCursor).not.toBeNull();

    const rest = afterCursor(items, decodeCursor(first.nextCursor as string, hash));
    const second = takePage(rest, 2, hash);
    expect(second.page.map((item) => item.id)).toEqual(['c', 'b']);

    const third = takePage(
      afterCursor(items, decodeCursor(second.nextCursor as string, hash)),
      2,
      hash,
    );
    expect(third.page.map((item) => item.id)).toEqual(['a']);
    expect(third.nextCursor).toBeNull();
  });
});
