import { describe, expect, it } from 'vitest';
import type { LoggedExercise, LoggedSet, Workout } from '../types';
import { suggest } from './progression';
import { e1rm, recordsFor, sessionPrs } from './stats';
import { platesPerSide } from './plates';
import { fromDisplay, roundTo, toDisplay } from './units';

const set = (weight: number | null, reps: number, type: LoggedSet['type'] = 'working'): LoggedSet => ({ weight, reps, type, done: true });
const session = (sets: LoggedSet[]): LoggedExercise => ({ exerciseId: 'bench', repMin: 8, repMax: 12, rest: 90, sets });
const workout = (t: number, sets: LoggedSet[]): Workout => ({ id: String(t), name: 'w', startedAt: t, finishedAt: t + 1, exercises: [session(sets)] });

describe('suggest (double progression)', () => {
  it('asks for a starting weight the first time', () => {
    expect(suggest([], 8, 12, 2.5, 'kg').kind).toBe('new');
  });

  it('adds an increment when every set hit the top of the range', () => {
    const s = suggest([session([set(60, 12), set(60, 12), set(60, 13)])], 8, 12, 2.5, 'kg');
    expect(s.kind).toBe('increase');
    expect(s.weight).toBeCloseTo(62.5);
    expect(s.reps).toBe(8);
  });

  it('holds the weight and asks for one more rep otherwise', () => {
    const s = suggest([session([set(60, 10), set(60, 9), set(60, 8)])], 8, 12, 2.5, 'kg');
    expect(s.kind).toBe('hold');
    expect(s.weight).toBe(60);
    expect(s.reps).toBe(9);
  });

  it('ignores warm-up sets', () => {
    const s = suggest([session([set(20, 5, 'warmup'), set(60, 12), set(60, 12)])], 8, 12, 2.5, 'kg');
    expect(s.kind).toBe('increase');
  });

  it('deloads after missing the bottom of the range twice', () => {
    const h = [session([set(100, 6), set(100, 5)]), session([set(100, 7)])];
    const s = suggest(h, 8, 12, 5, 'kg');
    expect(s.kind).toBe('deload');
    expect(s.weight).toBeCloseTo(90);
  });

  it('works in pounds', () => {
    const s = suggest([session([set(fromDisplay(135, 'lb'), 12), set(fromDisplay(135, 'lb'), 12)])], 8, 12, 5, 'lb');
    expect(toDisplay(s.weight!, 'lb')).toBe(140);
  });

  it('progresses reps for bodyweight moves', () => {
    const s = suggest([session([set(null, 7), set(null, 6)])], 5, 10, 2.5, 'kg');
    expect(s.kind).toBe('hold');
    expect(s.weight).toBeNull();
    expect(s.reps).toBe(7);
  });
});

describe('records and PRs', () => {
  it('computes Epley 1RM', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 10)).toBeCloseTo(133.33, 1);
  });

  it('finds the best numbers across workouts', () => {
    const r = recordsFor('bench', [workout(1, [set(60, 10)]), workout(2, [set(65, 6), set(50, 15)])]);
    expect(r.maxWeight).toBe(65);
    expect(r.maxReps).toBe(15);
    expect(r.bestE1rm).toBeCloseTo(e1rm(60, 10));
  });

  it('only counts the first set that beats a record within a session', () => {
    const prev = recordsFor('bench', [workout(1, [set(60, 8)])]);
    const prs = sessionPrs([set(62.5, 8), set(62.5, 8), set(62.5, 9)], prev, true);
    expect(prs[0]).toEqual(['weight', 'e1rm']);
    expect(prs[1]).toEqual([]);
    expect(prs[2]).toEqual(['e1rm']);
  });

  it('does not call the very first session a PR', () => {
    expect(sessionPrs([set(60, 8)], recordsFor('bench', []), false)).toEqual([[]]);
  });
});

describe('units and plates', () => {
  it('round-trips pounds', () => {
    expect(toDisplay(fromDisplay(225, 'lb'), 'lb')).toBe(225);
  });
  it('rounds to the step', () => {
    expect(roundTo(81, 2.5)).toBe(80);
    expect(roundTo(83.8, 2.5)).toBe(85);
  });
  it('loads a bar', () => {
    expect(platesPerSide(100, 20, 'kg').plates).toEqual([25, 15]);
    expect(platesPerSide(225, 45, 'lb').plates).toEqual([45, 45]);
    expect(platesPerSide(61, 20, 'kg').remainder).toBeCloseTo(0.5);
  });
});
