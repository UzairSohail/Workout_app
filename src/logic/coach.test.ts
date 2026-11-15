import { describe, expect, it } from 'vitest';
import type { Exercise, LoggedExercise, LoggedSet, Workout } from '../types';
import {
  acceptTune, checkInFacts, coachNotePrompt, parseCheckIn, parseNote, parsePlan, parseSwap, parseTune,
  planPrompt, setsText, tunePrompt, weightTrend, withAi, type TuneRow,
} from './coach';

const DAY = 864e5;
const set = (weight: number, reps: number): LoggedSet => ({ weight, reps, type: 'working', done: true });
const ex = (id: string, name: string, muscle: string, equipment = 'barbell'): Exercise => ({
  id, name, category: 'strength', equipment, primaryMuscles: [muscle], secondaryMuscles: [], instructions: [], images: [],
});
const bench = ex('Barbell_Bench_Press_-_Medium_Grip', 'Barbell Bench Press', 'chest');
const db = ex('Dumbbell_Bench_Press', 'Dumbbell Bench Press', 'chest', 'dumbbell');
const squat = ex('Barbell_Squat', 'Barbell Squat', 'quadriceps');
const byId = new Map([bench, db, squat].map((e) => [e.id, e]));
const le = (id: string, sets: LoggedSet[], extra: Partial<LoggedExercise> = {}): LoggedExercise => ({ exerciseId: id, repMin: 8, repMax: 12, rest: 90, sets, ...extra });
const workout = (id: string, at: number, exercises: LoggedExercise[]): Workout => ({ id, name: 'Push', startedAt: at, finishedAt: at + 3600e3, exercises });

const row: TuneRow = {
  index: 0, name: 'Barbell Bench Press', repMin: 8, repMax: 12, increment: 2.5,
  rule: { kind: 'hold', weight: 60, reps: 10, message: '' }, lastTop: 60, sessions: ['60×10, 60×9 (felt easy)'], daysSince: 3,
};

describe('AI coach: tuned weights', () => {
  it('accepts a pick within one step of last time, rounded to the step', () => {
    expect(acceptTune(row, { weight: 62.4, reps: 9, reason: 'Felt easy last time' }, 'kg')).toEqual({ weight: 62.5, reps: 9, message: 'Felt easy last time' });
  });
  it('rejects big jumps up or down and clamps reps to the range', () => {
    expect(acceptTune(row, { weight: 70, reps: 8, reason: 'x' }, 'kg')).toBeNull();
    expect(acceptTune(row, { weight: 45, reps: 8, reason: 'x' }, 'kg')).toBeNull();
    expect(acceptTune(row, { weight: 55, reps: 20, reason: 'Long break' }, 'kg')?.reps).toBe(12);
  });
  it('allows going up a step past a rule that already increases', () => {
    const up = { ...row, rule: { ...row.rule, kind: 'increase' as const, weight: 62.5 } };
    expect(acceptTune(up, { weight: 62.5, reps: 8, reason: 'ok' }, 'kg')?.weight).toBe(62.5);
    expect(acceptTune(up, { weight: 65, reps: 8, reason: 'ok' }, 'kg')).toBeNull();
  });
  it('works in pounds', () => {
    const lb = { ...row, increment: 5, lastTop: 100 * 0.45359237, rule: { ...row.rule, weight: 100 * 0.45359237 } };
    expect(acceptTune(lb, { weight: 105, reps: 8, reason: 'easy' }, 'lb')?.weight).toBeCloseTo(105 * 0.45359237);
  });
  it('reads picks by row and ignores junk', () => {
    const text = JSON.stringify({ picks: [{ row: 1, weight: 62.5, reps: 8, reason: 'easy' }, { row: 9, weight: 1, reps: 1, reason: 'no' }] });
    expect([...parseTune(text, [row], 'kg').keys()]).toEqual([0]);
    expect(parseTune('not json', [row], 'kg').size).toBe(0);
  });
  it('shows the tuned target in place of the rule', () => {
    const s = withAi(row.rule, le(bench.id, [], { ai: { weight: 62.5, reps: 8, message: 'Felt easy' } }), 60);
    expect(s).toMatchObject({ kind: 'increase', weight: 62.5, reps: 8, ai: true });
    expect(withAi(row.rule, le(bench.id, []), 60)).toBe(row.rule);
  });
  it('puts the history and the rule in the prompt', () => {
    const p = tunePrompt([row], 'kg', ['Body weight steady.']);
    expect(p).toContain('1. Barbell Bench Press');
    expect(p).toContain('felt easy');
    expect(p).toContain('rule says: 60 kg for 10 reps');
  });
});

describe('AI coach: coach note', () => {
  const now = Date.now();
  const before = workout('a', now - 3 * DAY, [le(bench.id, [set(60, 8), set(60, 8)])]);
  const today = workout('b', now - 3600e3, [le(bench.id, [set(62.5, 8), set(62.5, 7)], { feel: 'hard' })]);
  it('compares each lift with last time', () => {
    const p = coachNotePrompt(today, [before, today], byId, 'kg');
    expect(p).toContain('Barbell Bench Press: 62.5×8, 62.5×7 (target 8–12 reps, felt hard); last time 60×8, 60×8');
    expect(p).toMatch(/Chest \d/);
  });
  it('reads the note', () => {
    expect(parseNote('{"note":"  Bench up 2.5 kg.  "}')).toBe('Bench up 2.5 kg.');
    expect(parseNote('oops')).toBe('');
  });
});

describe('AI coach: workout from a sentence', () => {
  it('keeps only offered exercises, once each, with sane numbers', () => {
    const text = JSON.stringify({ name: 'Chest day', exercises: [
      { id: bench.id, sets: 20, repMin: 6, repMax: 4, rest: 5, why: 'Main lift' },
      { id: bench.id, sets: 3, repMin: 8, repMax: 12, rest: 90, why: 'dup' },
      { id: 'Made_Up', sets: 3, repMin: 8, repMax: 12, rest: 90, why: 'nope' },
    ] });
    const plan = parsePlan(text, [bench, db]);
    expect(plan?.exercises).toEqual([{ exerciseId: bench.id, sets: 6, repMin: 6, repMax: 6, rest: 30, why: 'Main lift' }]);
    expect(parsePlan('{"name":"x","exercises":[]}', [bench])).toBeNull();
  });
  it('includes the request and the exercise list', () => {
    const p = planPrompt('45 min, sore shoulders', [bench], ['No workouts logged yet.']);
    expect(p).toContain('"45 min, sore shoulders"');
    expect(p).toContain(`- ${bench.id}: Barbell Bench Press (barbell;`);
  });
});

describe('AI coach: swaps and check-in', () => {
  it('keeps up to 3 offered swaps', () => {
    const text = JSON.stringify({ picks: [{ id: db.id, why: 'Same mid chest, free weights' }, { id: 'X', why: '' }, { id: db.id, why: 'again' }] });
    expect(parseSwap(text, [db])).toEqual([{ id: db.id, why: 'Same mid chest, free weights' }]);
  });
  it('reads a check-in and drops a focus with no muscle', () => {
    expect(parseCheckIn('{"headline":"On track","points":["a","b"],"action":"focus"}')).toEqual({ headline: 'On track', points: ['a', 'b'], action: 'none' });
    expect(parseCheckIn('{"headline":"Tired","points":[],"action":"deload"}')?.action).toBe('deload');
    expect(parseCheckIn('{}')).toBeNull();
  });
  it('summarises lift trends per week', () => {
    const now = Date.now();
    const ws = [0, 7, 14, 21].map((d, i) => workout(`w${i}`, now - d * DAY - 3600e3, [le(squat.id, [set(100, 5)])]));
    const facts = checkInFacts(ws, byId, { units: 'kg' }, [], now).join('\n');
    expect(facts).toContain('Barbell Squat:');
    expect(facts).toContain('117');
  });
  it('describes body weight trend and sets', () => {
    const now = Date.now();
    const entries = [13, 10, 6, 3, 1].map((d, i) => ({ date: now - d * DAY, weight: 80 - i * 0.3 }));
    expect(weightTrend(entries, 'kg', now)).toMatch(/down about/);
    expect(setsText(le(bench.id, [set(60, 8)]), 'kg')).toBe('60×8');
  });
});
