import { describe, expect, it } from 'vitest';
import type { Feel, LoggedExercise, LoggedSet } from '../types';
import { suggest } from './progression';

const set = (weight: number | null, reps: number): LoggedSet => ({ weight, reps, type: 'working', done: true });
const session = (sets: LoggedSet[], feel?: Feel): LoggedExercise => ({ exerciseId: 'bench', repMin: 8, repMax: 12, rest: 90, sets, feel });

describe('suggest with "how did it feel?"', () => {
  it('goes up early when the last session felt easy', () => {
    const s = suggest([session([set(60, 10), set(60, 10), set(60, 9)], 'easy')], 8, 12, 2.5, 'kg');
    expect(s.kind).toBe('increase');
    expect(s.weight).toBeCloseTo(62.5);
  });

  it('holds instead of going up when the top reps felt hard', () => {
    const s = suggest([session([set(60, 12), set(60, 12), set(60, 12)], 'hard')], 8, 12, 2.5, 'kg');
    expect(s.kind).toBe('hold');
    expect(s.weight).toBe(60);
    expect(s.reps).toBe(12);
  });

  it('asks to match the reps, not add one, after a hard session', () => {
    const s = suggest([session([set(60, 10), set(60, 9), set(60, 9)], 'hard')], 8, 12, 2.5, 'kg');
    expect(s.weight).toBe(60);
    expect(s.reps).toBe(9);
  });

  it('still scales back after missed reps, even if it felt easy', () => {
    const s = suggest([session([set(60, 6), set(60, 5)], 'easy')], 8, 12, 2.5, 'kg');
    expect(s.kind).toBe('deload');
  });

  it('works as before with no answer', () => {
    const s = suggest([session([set(60, 10), set(60, 9), set(60, 8)])], 8, 12, 2.5, 'kg');
    expect(s.reps).toBe(9);
  });
});
