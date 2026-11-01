import { describe, expect, it } from 'vitest';
import type { LoggedSet, Workout } from '../types';
import { allBests, workoutPrs } from './records';

const DAY = 864e5;
const done = (weight: number | null, reps: number, type: LoggedSet['type'] = 'working'): LoggedSet => ({ weight, reps, type, done: true });
const wk = (t: number, exerciseId: string, sets: LoggedSet[], mode?: 'time'): Workout => ({
  id: String(t) + exerciseId, name: 'w', startedAt: t, finishedAt: t + 1,
  exercises: [{ exerciseId, repMin: 8, repMax: 12, rest: 90, sets, mode }],
});

describe('allBests', () => {
  it('lists each exercise once with its best numbers, latest record first', () => {
    const ws = [
      wk(1 * DAY, 'bench', [done(60, 8), done(70, 5)]),
      wk(2 * DAY, 'squat', [done(100, 5)]),
      wk(3 * DAY, 'bench', [done(65, 8)]),
      wk(4 * DAY, 'pullup', [done(0, 12)]),
    ];
    const b = allBests(ws);
    expect(b.map((x) => x.exerciseId)).toEqual(['pullup', 'bench', 'squat']);
    const bench = b.find((x) => x.exerciseId === 'bench')!;
    expect(bench.records.maxWeight).toBe(70);
    expect(bench.records.maxWeightReps).toBe(5);
    expect(bench.sessions).toBe(2);
    expect(b.find((x) => x.exerciseId === 'pullup')!.records.maxReps).toBe(12);
  });
  it('skips warm-ups and unfinished workouts', () => {
    const open: Workout = { ...wk(5 * DAY, 'row', [done(80, 8)]), finishedAt: undefined };
    expect(allBests([open, wk(1, 'dl', [done(140, 1, 'warmup')])])).toEqual([]);
  });
});

describe('workoutPrs', () => {
  it('reports the top PR set of each exercise against earlier workouts only', () => {
    const before = wk(1 * DAY, 'bench', [done(60, 8)]);
    const today = wk(2 * DAY, 'bench', [done(62.5, 8), done(65, 6)]);
    const later = wk(3 * DAY, 'bench', [done(100, 5)]);
    const prs = workoutPrs(today, [later, today, before]);
    expect(prs).toHaveLength(1);
    expect(prs[0]).toMatchObject({ exerciseId: 'bench', weight: 65, reps: 6 });
    expect(prs[0].kinds).toContain('weight');
  });
  it('does not count a first-ever session as a PR', () => {
    const today = wk(2 * DAY, 'bench', [done(60, 8)]);
    expect(workoutPrs(today, [today])).toEqual([]);
  });
});
