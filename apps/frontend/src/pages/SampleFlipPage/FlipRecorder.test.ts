import { describe, expect, it } from 'vitest';
import { BEATS_PER_BAR, COUNT_IN_BARS, recordingStateAt } from './FlipRecorder';

describe('recording clock', () => {
  it('counts four bars before recording and follows the project BPM', () => {
    const start = 10;
    expect(recordingStateAt(start, start, 120)).toMatchObject({ phase: 'count-in', bar: 1, beat: 1, elapsed: 0 });
    expect(recordingStateAt(start + 7.5, start, 120)).toMatchObject({ phase: 'count-in', bar: 4, beat: 4, elapsed: 0 });
    expect(recordingStateAt(start + 8, start, 120)).toMatchObject({ phase: 'recording', bar: 1, beat: 1, elapsed: 0 });
    expect(recordingStateAt(start + 8 + 3.5, start, 120)).toMatchObject({ phase: 'recording', bar: 2, beat: 4, elapsed: 3.5 });
  });

  it('uses BPM for the count-in duration and keeps beat values one-based', () => {
    const start = 0;
    const countInSeconds = COUNT_IN_BARS * BEATS_PER_BAR * 60 / 90;
    expect(recordingStateAt(countInSeconds - 0.01, start, 90).phase).toBe('count-in');
    expect(recordingStateAt(countInSeconds, start, 90)).toMatchObject({ phase: 'recording', bar: 1, beat: 1, elapsed: 0 });
    expect(recordingStateAt(countInSeconds + 60 / 90, start, 90)).toMatchObject({ phase: 'recording', bar: 1, beat: 2 });
  });
});
