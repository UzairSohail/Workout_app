import { describe, expect, it } from 'vitest';
import type { Exercise, LoggedExercise, LoggedSet, Workout } from '../types';
import { setCalories, workoutCalories } from './calories';

const ex = (id: string, extra: Partial<Exercise> = {}) =>
  ({ id, name: id, category: 'strength', equipment: 'barbell', mechanic: 'compound', primaryMuscles: ['chest'], secondaryMuscles: [], instructions: [], images: [], ...extra }) as Exercise;
const set = (reps: number, done = true, type: LoggedSet['type'] = 'working'): LoggedSet => ({ weight: 60, reps, type, done });
const le = (sets: LoggedSet[], extra: Partial<LoggedExercise> = {}): LoggedExercise => ({ exerciseId: 'bench', repMin: 8, repMax: 12, rest: 90, sets, ...extra });

describe('calories', () => {
  it('counts work at a lifting MET plus the rest after the set', () => {
    // 10 reps × 3 s at MET 7 + 90 s rest at MET 2.5, for 80 kg
    expect(setCalories(set(10), le([]), ex('bench'), 80)).toBeCloseTo((7 * 80 * 30 + 2.5 * 80 * 90) / 3600, 5);
  });
  it('ignores sets not done, and skips rest inside a superset', () => {
    expect(setCalories(set(10, false), le([]), ex('bench'), 80)).toBe(0);
    expect(setCalories(set(10), le([], { supersetWithNext: true }), ex('bench'), 80)).toBeCloseTo((7 * 80 * 30) / 3600, 5);
  });
  it('uses seconds directly for timed sets', () => {
    const plank = setCalories(set(60), le([], { mode: 'time', rest: 0 }), ex('plank', { mechanic: 'isolation' }), 80);
    expect(plank).toBeCloseTo((5 * 80 * 60) / 3600, 5);
  });
  it('grows with every set and falls back to 70 kg', () => {
    const byId = new Map([['bench', ex('bench')]]);
    const w = (n: number): Workout => ({ id: 'w', name: 'w', startedAt: 0, exercises: [le(Array.from({ length: 3 }, (_, i) => set(10, i < n)))] });
    const totals = [0, 1, 2, 3].map((n) => workoutCalories(w(n), byId, 80));
    expect(totals[0]).toBe(0);
    expect(totals[1]).toBeGreaterThan(0);
    expect(totals[3]).toBeGreaterThan(totals[2]);
    expect(workoutCalories(w(3), byId, undefined)).toBe(workoutCalories(w(3), byId, 70));
  });
});
