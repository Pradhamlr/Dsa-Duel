import { describe, it, expect } from 'vitest';
import { toDayString, bucketByDay, computeStreaks, buildDailyHistory } from './streakCalculator.js';

const day = (isoDate) => new Date(`${isoDate}T12:00:00Z`);

describe('bucketByDay', () => {
  it('groups timestamps into UTC calendar days and counts each', () => {
    const counts = bucketByDay([day('2026-08-01'), day('2026-08-01'), day('2026-08-02')]);
    expect(counts.get('2026-08-01')).toBe(2);
    expect(counts.get('2026-08-02')).toBe(1);
  });
});

describe('computeStreaks', () => {
  it('returns zero/zero with no activity at all', () => {
    expect(computeStreaks(new Map())).toEqual({ current: 0, longest: 0 });
  });

  it('counts a current streak that includes today', () => {
    const now = day('2026-08-06');
    const counts = bucketByDay([day('2026-08-04'), day('2026-08-05'), day('2026-08-06')]);
    expect(computeStreaks(counts, now)).toEqual({ current: 3, longest: 3 });
  });

  it('keeps a streak alive if yesterday had activity but today has none yet', () => {
    const now = day('2026-08-06');
    const counts = bucketByDay([day('2026-08-04'), day('2026-08-05')]);
    expect(computeStreaks(counts, now).current).toBe(2);
  });

  it('reports a broken streak (current: 0) once a day is fully skipped', () => {
    const now = day('2026-08-06');
    const counts = bucketByDay([day('2026-08-01'), day('2026-08-02')]);
    expect(computeStreaks(counts, now).current).toBe(0);
  });

  it('finds the longest historical run even when the current streak is shorter', () => {
    const now = day('2026-08-10');
    const counts = bucketByDay([
      day('2026-08-01'), day('2026-08-02'), day('2026-08-03'), day('2026-08-04'), // 4-day run
      day('2026-08-10') // isolated day, current streak of 1
    ]);
    expect(computeStreaks(counts, now)).toEqual({ current: 1, longest: 4 });
  });

  it('does not let a day with a recorded but zero count count as active', () => {
    const counts = new Map([['2026-08-05', 0], ['2026-08-06', 2]]);
    const now = day('2026-08-06');
    expect(computeStreaks(counts, now).current).toBe(1);
  });
});

describe('buildDailyHistory', () => {
  it('returns exactly `days` entries, oldest first, ending on now', () => {
    const now = day('2026-08-06');
    const counts = bucketByDay([day('2026-08-05'), day('2026-08-06')]);
    const history = buildDailyHistory(counts, 5, now);
    expect(history.map((h) => h.date)).toEqual(['2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06']);
    expect(history[history.length - 1]).toEqual({ date: '2026-08-06', count: 1 });
    expect(history[0].count).toBe(0);
  });

  it('fills gaps with zero rather than omitting them', () => {
    const now = day('2026-08-03');
    const counts = bucketByDay([day('2026-08-01')]);
    const history = buildDailyHistory(counts, 3, now);
    expect(history).toEqual([
      { date: '2026-08-01', count: 1 },
      { date: '2026-08-02', count: 0 },
      { date: '2026-08-03', count: 0 }
    ]);
  });
});

describe('toDayString', () => {
  it('formats a date as YYYY-MM-DD in UTC', () => {
    expect(toDayString(new Date('2026-08-06T23:59:00Z'))).toBe('2026-08-06');
  });
});
