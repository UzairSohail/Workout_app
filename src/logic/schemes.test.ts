import { describe, expect, it } from 'vitest';
import type { LoggedExercise, PlannedExercise, ProgramState, SchemeKind } from '../types';
import { advance, completeDay, liftKey, prescribe } from './schemes';
import { fromDisplay, toDisplay } from './units';

const plan = (scheme: SchemeKind, sets = 5, reps = 5): PlannedExercise & { scheme: SchemeKind } => ({
  exerciseId: 'squat', sets, repMin: reps, repMax: reps, rest: 180, scheme,
});
const logged = (sets: [number, number, number][]): LoggedExercise => ({
  exerciseId: 'squat', repMin: 1, repMax: 10, rest: 180,
  sets: sets.map(([weight, reps, target]) => ({ weight, reps, target, type: 'working', done: true })),
});
const lift = (weight: number | null, stage = 0, fails = 0) => ({ weight, stage, fails });

describe('5/3/1', () => {
  it('prescribes week percentages of the training max, rounded to 2.5 kg', () => {
    const rx = prescribe(plan('531', 3, 5), lift(100), 0, 5, 'kg');
    expect(rx.sets.map((s) => s.weight)).toEqual([65, 75, 85]);
    expect(rx.sets.map((s) => s.target)).toEqual([5, 5, 5]);
    expect(rx.sets.map((s) => s.amrap)).toEqual([false, false, true]);
    const wk3 = prescribe(plan('531'), lift(100), 2, 5, 'kg');
    expect(wk3.sets.map((s) => [s.weight, s.target])).toEqual([[75, 5], [85, 3], [95, 1]]);
    expect(prescribe(plan('531'), lift(100), 3, 5, 'kg').sets.every((s) => !s.amrap)).toBe(true);
  });

  it('rounds to 5 lb', () => {
    const rx = prescribe(plan('531'), lift(fromDisplay(225, 'lb')), 0, 10, 'lb');
    expect(rx.sets.map((s) => toDisplay(s.weight!, 'lb'))).toEqual([145, 170, 190]);
  });

  it('asks for a training max when there is none', () => {
    const rx = prescribe(plan('531'), undefined, 0, 5, 'kg');
    expect(rx.sets.every((s) => s.weight === null)).toBe(true);
    expect(rx.note).toMatch(/training max/);
  });

  it('moves weeks once every day is done and raises the TM after the deload', () => {
    const days = ['a', 'b'];
    let st: ProgramState = { programId: 'p', week: 0, doneDays: [], lifts: { [liftKey('531', 'squat')]: lift(100), [liftKey('linear', 'x')]: lift(50) } };
    st = completeDay(st, 'a', days, () => 5, 'kg');
    expect(st.week).toBe(0);
    st = completeDay(st, 'a', days, () => 5, 'kg');
    expect(st.doneDays).toEqual(['a']);
    st = completeDay(st, 'b', days, () => 5, 'kg');
    expect(st).toMatchObject({ week: 1, doneDays: [] });
    for (let wk = 1; wk < 4; wk++) {
      st = completeDay(completeDay(st, 'a', days, () => 5, 'kg'), 'b', days, () => 5, 'kg');
    }
    expect(st.week).toBe(0);
    expect(st.lifts[liftKey('531', 'squat')].weight).toBe(105);
    expect(st.lifts[liftKey('linear', 'x')].weight).toBe(50);
  });
});

describe('linear', () => {
  it('adds weight after a full session', () => {
    expect(advance('linear', lift(60), logged([[60, 5, 5], [60, 5, 5]]), 2, 2.5, 'kg')).toEqual(lift(62.5));
  });
  it('counts misses and deloads 10% after three', () => {
    let l = lift(100);
    for (let i = 0; i < 2; i++) l = advance('linear', l, logged([[100, 5, 5], [100, 3, 5]]), 2, 2.5, 'kg');
    expect(l).toEqual(lift(100, 0, 2));
    l = advance('linear', l, logged([[100, 5, 5], [100, 3, 5]]), 2, 2.5, 'kg');
    expect(l).toEqual(lift(90));
  });
  it('treats skipped sets as a miss', () => {
    expect(advance('linear', lift(60), logged([[60, 5, 5]]), 5, 2.5, 'kg').fails).toBe(1);
  });
  it('starts from the weight actually used', () => {
    expect(advance('linear', lift(null), logged([[40, 5, 5]]), 1, 2.5, 'kg').weight).toBe(42.5);
  });
});

describe('GZCLP', () => {
  it('T1 steps 5×3 → 6×2 → 10×1 on failure, then resets at 85%', () => {
    const fail = logged([[100, 3, 3], [100, 1, 3]]);
    let l = advance('gzcl-t1', lift(100), fail, 5, 5, 'kg');
    expect(l).toEqual(lift(100, 1));
    expect(prescribe(plan('gzcl-t1'), l, 0, 5, 'kg').sets.length).toBe(6);
    l = advance('gzcl-t1', l, fail, 6, 5, 'kg');
    expect(l.stage).toBe(2);
    l = advance('gzcl-t1', l, fail, 10, 5, 'kg');
    expect(l).toEqual(lift(85));
  });
  it('T1 adds weight and keeps the stage on success', () => {
    const ok = logged(Array.from({ length: 6 }, () => [100, 2, 2] as [number, number, number]));
    expect(advance('gzcl-t1', lift(100, 1), ok, 6, 5, 'kg')).toEqual(lift(105, 1));
  });
  it('T3 adds weight only when the last set reaches 25', () => {
    expect(advance('gzcl-t3', lift(20), logged([[20, 15, 15], [20, 15, 15], [20, 22, 15]]), 3, 2.5, 'kg').weight).toBe(20);
    expect(advance('gzcl-t3', lift(20), logged([[20, 15, 15], [20, 15, 15], [20, 26, 15]]), 3, 2.5, 'kg').weight).toBe(22.5);
  });
  it('T2 has no AMRAP set', () => {
    expect(prescribe(plan('gzcl-t2'), lift(60), 0, 2.5, 'kg').sets.some((s) => s.amrap)).toBe(false);
  });
});
