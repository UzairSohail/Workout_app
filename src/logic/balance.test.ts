import { describe, expect, it } from 'vitest';
import type { Exercise, LoggedSet, Workout } from '../types';
import { muscleBalance } from './balance';

const done = (): LoggedSet => ({ weight: 50, reps: 8, type: 'working', done: true });
const ex = (id: string, primaryMuscles: string[], secondaryMuscles: string[] = []): Exercise =>
  ({ id, name: id, category: 'strength', equipment: 'barbell', primaryMuscles, secondaryMuscles, instructions: [], images: [] });
const byId = new Map([
  ex('bench', ['chest'], ['triceps', 'shoulders']),
  ex('row', ['middle back'], ['lats', 'biceps']),
  ex('squat', ['quadriceps'], ['glutes', 'hamstrings']),
].map((e) => [e.id, e]));
const wk = (t: number, exerciseId: string, n: number): Workout => ({
  id: `${t}${exerciseId}`, name: 'w', startedAt: t, finishedAt: t + 1,
  exercises: [{ exerciseId, repMin: 8, repMax: 12, rest: 90, sets: Array.from({ length: n }, done) }],
});

describe('muscleBalance', () => {
  it('counts main muscles fully, helpers at half, once per group, and lists skipped groups', () => {
    const b = muscleBalance([wk(10, 'bench', 12), wk(10, 'row', 4), wk(1, 'squat', 9)], byId, 5);
    const g = Object.fromEntries(b.groups.map((x) => [x.name, x]));
    expect(g.Chest).toMatchObject({ sets: 12, status: 'good' });
    expect(g.Triceps).toMatchObject({ sets: 6, status: 'low' });
    expect(g.Back.sets).toBe(4); // middle back and lats in one group: counted once
    expect(g.Biceps.sets).toBe(2);
    expect(g.Quads.status).toBe('skipped'); // that workout is before `since`
    expect(b.skipped).toEqual(['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs', 'Lower back']);
    expect(b.push).toBe(24);
    expect(b.pull).toBe(6);
    expect(b.tip).toMatch(/pushing a lot more/);
  });
});
