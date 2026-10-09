import { describe, expect, it } from 'vitest';
import type { Exercise, LoggedExercise, LoggedSet, Workout } from '../types';
import { activeMs, workoutCalories } from './calories';

const ex = (id: string, extra: Partial<Exercise> = {}) =>
  ({ id, name: id, category: 'strength', equipment: 'barbell', mechanic: 'compound', primaryMuscles: ['chest'], secondaryMuscles: [], instructions: [], images: [], ...extra }) as Exercise;
const MIN = 60_000;
const set = (doneAt?: number, type: LoggedSet['type'] = 'working'): LoggedSet => ({ weight: 60, reps: 10, type, done: doneAt !== undefined, doneAt });
const le = (exerciseId: string, sets: LoggedSet[]): LoggedExercise => ({ exerciseId, repMin: 8, repMax: 12, rest: 90, sets });
const workout = (exercises: LoggedExercise[], finishedAt?: number): Workout => ({ id: 'w', name: 'w', startedAt: 0, finishedAt, exercises });
const byId = new Map([['bench', ex('bench')], ['curl', ex('curl', { mechanic: 'isolation' })], ['bike', ex('bike', { category: 'cardio', mechanic: undefined })]]);

describe('calories', () => {
  it('is zero before any set is done', () => {
    expect(workoutCalories(workout([le('bench', [set(), set()])]), byId, 80)).toBe(0);
  });
  it('counts the whole hour of a compound session, minus resting burn', () => {
    // 20 sets, one every 3 minutes, for 80 kg: (4.5 − 1) × 80 × 1 h = 280
    const sets = Array.from({ length: 20 }, (_, i) => set((i + 1) * 3 * MIN));
    expect(workoutCalories(workout([le('bench', sets)]), byId, 80)).toBe(280);
  });
  it('grows after each set', () => {
    const w = (n: number) => workout([le('bench', Array.from({ length: 4 }, (_, i) => (i < n ? set((i + 1) * 3 * MIN) : set())))]);
    const totals = [1, 2, 3, 4].map((n) => workoutCalories(w(n), byId, 80));
    expect(totals[1]).toBeGreaterThan(totals[0]);
    expect(totals[3]).toBeGreaterThan(totals[2]);
  });
  it('averages compound, isolation and cardio sets', () => {
    const w = workout([le('bench', [set(5 * MIN)]), le('curl', [set(10 * MIN)]), le('bike', [set(15 * MIN)])]);
    expect(workoutCalories(w, byId, 70)).toBe(Math.round(((4.5 + 3.5 + 7) / 3 - 1) * 70 * 0.25));
  });
  it('trims long pauses between sets to 5 minutes', () => {
    expect(activeMs(workout([le('bench', [set(5 * MIN), set(65 * MIN)])]))).toBe(10 * MIN);
  });
  it('assumes 3 minutes a set for workouts logged before set times existed', () => {
    const old = workout([le('bench', [{ weight: 60, reps: 10, type: 'working', done: true }])], 45 * MIN);
    expect(activeMs(old)).toBe(3 * MIN);
    expect(workoutCalories(old, byId, undefined)).toBe(Math.round(3.5 * 70 * 0.05));
  });
});
