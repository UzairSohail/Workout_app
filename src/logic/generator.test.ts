import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Exercise } from '../types';
import { GENERATOR_EXERCISES, generateProgram, weekCoverage, weeklySets, WEEKLY_SETS, type GeneratorInput } from './generator';
import { MOVE_BY_ID } from './targets';
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

  it('hits the chest from more than one angle on a push day', () => {
    const push = generateProgram({ ...base, experience: 'intermediate' }, 'p').days[0];
    const patterns = push.exercises.map((e) => MOVE_BY_ID.get(e.exerciseId)!.pattern);
    expect(patterns).toContain('press-incline');
    expect(patterns.some((p) => p === 'press-flat' || p === 'press-decline')).toBe(true);
  });

  it('covers upper and mid chest every week, even with one chest exercise per day', () => {
    for (const days of [2, 3, 4, 5, 6]) {
      for (const equipment of ['gym', 'dumbbells'] as const) {
        const { covered } = weekCoverage(generateProgram({ ...base, days, equipment, minutes: 60 }, 'p'));
        expect(covered).toEqual(expect.arrayContaining(['chestUpper', 'chestMid']));
      }
    }
  });

  it('trains each head of the arms and both jobs of the hamstrings on a split', () => {
    const p = generateProgram({ ...base, experience: 'intermediate', minutes: 60 }, 'p');
    expect(weekCoverage(p).missing).toEqual([]);
    const pull = p.days[1].exercises.map((e) => MOVE_BY_ID.get(e.exerciseId)!);
    expect(pull.some((m) => (m.hits.bicepsLong ?? 0) >= 0.8)).toBe(true);
    expect(pull.some((m) => (m.hits.bicepsShort ?? 0) >= 1)).toBe(true);
    const legs = p.days[2].exercises.map((e) => MOVE_BY_ID.get(e.exerciseId)!.pattern);
    expect(legs).toEqual(expect.arrayContaining(['hinge', 'leg-curl']));
  });

  it('puts compound lifts before isolation work', () => {
    for (const d of generateProgram({ ...base, days: 6, experience: 'intermediate', minutes: 90 }, 'p').days) {
      const compound = d.exercises.map((e) => MOVE_BY_ID.get(e.exerciseId)!.compound);
      expect(compound).toEqual([...compound].sort((a, b) => Number(b) - Number(a)));
    }
  });

  it('skips exercises the gym is missing', () => {
    const p = generateProgram({ ...base, days: 4 }, 'p', 0, (id) => MOVE_BY_ID.get(id)!.pattern !== 'press-incline');
    const used = p.days.flatMap((d) => d.exercises.map((e) => MOVE_BY_ID.get(e.exerciseId)!.pattern));
    expect(used).not.toContain('press-incline');
  });

  it('aims for 10–20 weekly sets on the big muscles when there is time', () => {
    const p = generateProgram({ ...base, days: 4, experience: 'intermediate', minutes: 60 }, 'p');
    const sets = weeklySets(p);
    for (const g of ['chest', 'back', 'delts', 'quads', 'hams', 'glutes'] as const) {
      expect(sets.get(g)).toBeGreaterThanOrEqual(WEEKLY_SETS.low);
      expect(sets.get(g)).toBeLessThanOrEqual(WEEKLY_SETS.high);
    }
  });

  it('never goes over 20 weekly sets or past the session time', () => {
    for (const days of [2, 3, 4, 5, 6]) {
      for (const minutes of [30, 45, 60, 90]) {
        const p = generateProgram({ ...base, days, minutes, experience: 'intermediate' }, 'p');
        for (const n of weeklySets(p).values()) expect(n).toBeLessThanOrEqual(WEEKLY_SETS.high);
        for (const d of p.days) {
          expect(d.exercises.reduce((n, e) => n + e.sets, 0)).toBeLessThanOrEqual({ 30: 12, 45: 16, 60: 20, 90: 28 }[minutes]!);
          for (const e of d.exercises) expect(e.sets).toBeGreaterThanOrEqual(2);
        }
      }
    }
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
