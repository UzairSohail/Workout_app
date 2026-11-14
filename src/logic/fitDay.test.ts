import { describe, expect, it } from 'vitest';
import type { Workout } from '../types';
import { estimateMinutes, fitDay, isFinisherMove, nextDayIndex } from './generator';
import { MOVE_BY_ID } from './targets';
import { BUILT_IN_PROGRAMS } from '../programs';

const ppl = BUILT_IN_PROGRAMS.find((p) => p.name === 'Push / Pull / Legs')!;
const push = ppl.days[0];
const isCore = (id: string) => { const mv = MOVE_BY_ID.get(id); return !!mv && isFinisherMove(mv); };

describe('fitDay', () => {
  it('leaves the day alone when set to the plan', () => {
    expect(fitDay(push, { size: { kind: 'plan' }, finisher: false }).exercises).toEqual(push.exercises);
  });

  it('trims to fewer exercises from the end', () => {
    const d = fitDay(push, { size: { kind: 'exercises', n: 4 }, finisher: false });
    expect(d.exercises.map((e) => e.exerciseId)).toEqual(push.exercises.slice(0, 4).map((e) => e.exerciseId));
  });

  it('adds push exercises without repeats to reach a bigger count', () => {
    const d = fitDay(push, { size: { kind: 'exercises', n: 9 }, finisher: false });
    expect(d.exercises).toHaveLength(9);
    expect(new Set(d.exercises.map((e) => e.exerciseId)).size).toBe(9);
    const added = d.exercises.filter((e) => e.added);
    expect(added).toHaveLength(9 - push.exercises.length);
    // Added work trains what a push day trains, not legs or back.
    for (const e of added) {
      const mv = MOVE_BY_ID.get(e.exerciseId)!;
      expect(Object.keys(mv.hits).some((t) => /chest|delt|triceps/i.test(t))).toBe(true);
    }
  });

  it('fits a time budget', () => {
    for (const n of [30, 45, 90]) {
      const d = fitDay(push, { size: { kind: 'minutes', n }, finisher: true });
      expect(estimateMinutes(d)).toBeLessThanOrEqual(n + 5);
    }
    expect(fitDay(push, { size: { kind: 'minutes', n: 90 }, finisher: false }).exercises.length)
      .toBeGreaterThan(fitDay(push, { size: { kind: 'minutes', n: 30 }, finisher: false }).exercises.length);
  });

  it('adds 2 abs + 1 lower back at the end, on top of the exercise count', () => {
    const d = fitDay(push, { size: { kind: 'exercises', n: 5 }, finisher: true });
    expect(d.exercises).toHaveLength(8);
    const tail = d.exercises.slice(5).map((e) => MOVE_BY_ID.get(e.exerciseId)!);
    expect(tail.every((mv) => isFinisherMove(mv))).toBe(true);
    expect(tail.filter((mv) => mv.pattern === 'back-ext')).toHaveLength(1);
    expect(d.exercises.slice(0, 5).some((e) => isCore(e.exerciseId))).toBe(false);
  });

  it("doesn't add a second finisher to a day that already ends with one", () => {
    const once = fitDay(push, { size: { kind: 'plan' }, finisher: true });
    expect(fitDay(once, { size: { kind: 'plan' }, finisher: true }).exercises).toEqual(once.exercises);
  });
});

describe('nextDayIndex', () => {
  const done = (dayIdx: number, at: number): Workout => ({
    id: `w${at}`, name: '', programId: ppl.id, dayId: ppl.days[dayIdx].id, startedAt: at, finishedAt: at + 1, exercises: [],
  });
  it('follows the last split day finished, even after a manual swap and past 3 a week', () => {
    expect(nextDayIndex(ppl, [], 0)).toBe(0);
    expect(nextDayIndex(ppl, [done(0, 1), done(1, 2)], 0)).toBe(2);
    expect(nextDayIndex(ppl, [done(0, 1), done(1, 2), done(2, 3), done(0, 4)], 0)).toBe(1);
    // Swapped to Legs instead of Pull: Push comes next.
    expect(nextDayIndex(ppl, [done(0, 1), done(2, 2)], 0)).toBe(0);
  });
});
