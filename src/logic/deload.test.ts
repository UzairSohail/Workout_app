import { describe, expect, it } from 'vitest';
import type { LoggedExercise, Workout } from '../types';
import { deloadDue, deloadExercise, trainingWeeks } from './deload';

const D = 864e5;
// A Wednesday at noon.
const NOW = new Date(2026, 10, 4, 12).getTime();
const w = (daysAgo: number): Workout => ({ id: String(daysAgo), name: 'w', startedAt: NOW - daysAgo * D, finishedAt: NOW - daysAgo * D + 1, exercises: [] });
/** Two workouts a week (Monday and Tuesday) for `weeks` full weeks before this one. */
const steady = (weeks: number) => Array.from({ length: weeks }, (_, i) => [w(8 + i * 7), w(9 + i * 7)]).flat();

describe('deload', () => {
  it('counts consecutive weeks with at least two workouts', () => {
    expect(trainingWeeks(steady(6), 0, NOW)).toBe(6);
    expect(trainingWeeks([...steady(6), w(1), w(2)], 0, NOW)).toBe(7);
    expect(trainingWeeks(steady(6).filter((x) => x.id !== '22'), 0, NOW)).toBe(2);
  });

  it('suggests a deload after 6 hard weeks, not before', () => {
    expect(deloadDue(steady(5), {}, NOW)).toBe(false);
    expect(deloadDue(steady(6), {}, NOW)).toBe(true);
  });

  it('starts counting again after a deload, and waits two weeks after "not now"', () => {
    expect(deloadDue(steady(8), { lastDeloadAt: NOW - 20 * D }, NOW)).toBe(false);
    expect(deloadDue(steady(8), { deloadSnoozedAt: NOW - 3 * D }, NOW)).toBe(false);
    expect(deloadDue(steady(8), { deloadSnoozedAt: NOW - 15 * D }, NOW)).toBe(true);
    expect(deloadDue(steady(8), { deloadUntil: NOW + D }, NOW)).toBe(false);
  });

  it('halves the work sets and takes about 10% off, keeping warm-ups', () => {
    const le: LoggedExercise = { exerciseId: 'x', repMin: 8, repMax: 12, rest: 90, sets: [
      { weight: 40, reps: null, type: 'warmup', done: false },
      ...[0, 1, 2].map(() => ({ weight: 100, reps: null, type: 'working' as const, done: false })),
    ] };
    const d = deloadExercise(le, 2.5, 'kg');
    expect(d.deload).toBe(true);
    expect(d.sets.map((s) => [s.type, s.weight])).toEqual([['warmup', 40], ['working', 90], ['working', 90]]);
  });
});
