import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Exercise } from '../types';
import { GENERATOR_EXERCISES, generateProgram, type GeneratorInput } from './generator';
import { warmupSets } from './warmup';
import { toDisplay } from './units';

const library: Exercise[] = JSON.parse(readFileSync(new URL('../../public/exercises.json', import.meta.url), 'utf8'));
const byId = new Map(library.map((e) => [e.id, e]));
const base: GeneratorInput = { goal: 'muscle', days: 3, experience: 'beginner', equipment: 'gym', minutes: 60 };

describe('generateProgram', () => {
  it('only uses exercises that exist in the library', () => {
    expect(GENERATOR_EXERCISES.filter((id) => !byId.has(id))).toEqual([]);
  });

  it('makes one day per training day, up to the time limit, with no repeats in a day', () => {
    for (const days of [2, 3, 4, 5, 6]) {
      for (const minutes of [30, 45, 60, 90]) {
        const p = generateProgram({ ...base, days, minutes }, 'p');
        expect(p.days).toHaveLength(days);
        for (const d of p.days) {
          expect(d.exercises.length).toBeGreaterThanOrEqual(3);
          expect(d.exercises.length).toBeLessThanOrEqual({ 30: 4, 45: 5, 60: 6, 90: 8 }[minutes]!);
          expect(new Set(d.exercises.map((e) => e.exerciseId)).size).toBe(d.exercises.length);
        }
      }
    }
  });

  it('respects the equipment available', () => {
    const body = generateProgram({ ...base, equipment: 'bodyweight', days: 4 }, 'p');
    const used = body.days.flatMap((d) => d.exercises.map((e) => byId.get(e.exerciseId)!.equipment));
    expect(used.every((eq) => eq === 'body only' || eq === 'other')).toBe(true);
    const db = generateProgram({ ...base, equipment: 'dumbbells' }, 'p');
    const dbEq = db.days.flatMap((d) => d.exercises.map((e) => byId.get(e.exerciseId)!.equipment));
    expect(dbEq.some((eq) => ['barbell', 'machine', 'cable'].includes(eq))).toBe(false);
  });

  it('varies the B days and picks the split by days and experience', () => {
    const ul = generateProgram({ ...base, days: 4 }, 'p');
    expect(ul.days.map((d) => d.name)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B']);
    expect(ul.days[0].exercises[0].exerciseId).not.toBe(ul.days[2].exercises[0].exerciseId);
    expect(generateProgram({ ...base, experience: 'intermediate' }, 'p').days.map((d) => d.name)).toEqual(['Push', 'Pull', 'Legs']);
  });

  it('uses heavier, lower-rep work for strength', () => {
    const s = generateProgram({ ...base, goal: 'strength', experience: 'intermediate' }, 'p');
    expect(s.days[0].exercises[0]).toMatchObject({ sets: 4, repMin: 4, repMax: 6 });
  });
});

describe('warmupSets', () => {
  it('ramps a barbell lift from the empty bar', () => {
    const sets = warmupSets(100, 'barbell', 'kg');
    expect(sets.map((s) => [toDisplay(s.weight!, 'kg'), s.target])).toEqual([[20, 10], [40, 5], [60, 3], [80, 2]]);
    expect(sets.every((s) => s.type === 'warmup' && !s.done)).toBe(true);
  });
  it('skips sets that would not be lighter than the work set', () => {
    expect(warmupSets(25, 'barbell', 'kg').map((s) => toDisplay(s.weight!, 'kg'))).toEqual([]);
    expect(warmupSets(null, 'barbell', 'kg')).toEqual([]);
  });
  it('uses two ramp sets for dumbbells', () => {
    expect(warmupSets(30, 'dumbbell', 'kg').map((s) => [toDisplay(s.weight!, 'kg'), s.target])).toEqual([[16, 8], [22, 4]]);
  });
});
