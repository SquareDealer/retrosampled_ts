import { formatDuration } from './sample.types';

describe('formatDuration', () => {
  it('formats seconds as m:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(32)).toBe('0:32');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(125)).toBe('2:05');
  });

  it('floors fractional seconds and clamps negatives', () => {
    expect(formatDuration(32.9)).toBe('0:32');
    expect(formatDuration(-10)).toBe('0:00');
  });
});
