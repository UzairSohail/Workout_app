import { describe, expect, it } from 'vitest';
import type { LoggedSet, Workout } from '../types';
import { compareWorkouts, previousLike } from './summary';

const done = (weight: number, reps: number): LoggedSet => ({ weight, reps, type: 'working', done: true });
const wk = (id: string, t: number, extra: Partial<Workout>, sets: LoggedSet[] = [done(50, 10)]): Workout => ({
  id, name: 'Push', startedAt: t, finishedAt: t + 3600e3,
  exercises: [{ exerciseId: 'bench', repMin: 8, repMax: 12, rest: 90, sets }], ...extra,
});

describe('previousLike', () => {
  it('prefers the same program day, then the same name, and never a later workout', () => {
    const a = wk('a', 1, { programId: 'p', dayId: 'd1' });
    const b = wk('b', 2, { name: 'push ' });
    const c = wk('c', 3, { programId: 'p', dayId: 'd2' });
    const today = wk('t', 4, { programId: 'p', dayId: 'd1' });
    const later = wk('l', 5, { programId: 'p', dayId: 'd1' });
    expect(previousLike(today, [later, today, c, b, a])?.id).toBe('a');
    expect(previousLike({ ...today, programId: undefined }, [later, today, c, b, a])?.id).toBe('c');
    expect(previousLike({ ...today, name: 'Legs', programId: undefined }, [b, a])).toBeUndefined();
  });
});

describe('compareWorkouts', () => {
  it('works out volume, set and duration changes', () => {
    const prev = wk('a', 0, {}, [done(50, 10)]);
    const now = wk('b', 1, { finishedAt: 1 + 1800e3 }, [done(50, 10), done(50, 10)]);
    const c = compareWorkouts(now, prev);
    expect(c.volume).toMatchObject({ now: 1000, before: 500, diff: 500, pct: 100 });
    expect(c.sets.diff).toBe(1);
    expect(c.duration.diff).toBe(-1800e3);
  });
});
