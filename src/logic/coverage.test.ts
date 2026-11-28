import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Exercise, Program, Workout } from '../types';
import { covers, fitDay, generateProgram, generateToday, SESSION_MINUTES, SPLITS, weekCoverage, type GeneratorInput } from './generator';
import { catchUpDayId, splitCatchUp } from './splitCatchUp';
import { MOVE_BY_ID, TARGETS, type Group, type Target } from './targets';

const library: Exercise[] = JSON.parse(readFileSync(new URL('../../public/exercises.json', import.meta.url), 'utf8'));
const byId = new Map(library.map((e) => [e.id, e]));
const parts = (groups: Group[]) => (Object.keys(TARGETS) as Target[]).filter((t) => groups.includes(TARGETS[t].group));
const coveredBy = (ids: string[], t: Target) => ids.some((id) => covers(MOVE_BY_ID.get(id)!, t));
const MAIN: Group[] = ['chest', 'delts', 'rearDelts', 'back', 'biceps', 'triceps', 'quads', 'hams', 'glutes', 'calves'];

describe('every muscle part gets an exercise', () => {
  it('in every gym routine of 45 minutes or more, whatever the split (60 for two-day upper / lower)', () => {
    for (const s of SPLITS) for (const days of s.days) for (const minutes of SESSION_MINUTES.filter((m) => m >= (s.kind === 'upperLower' && days === 2 ? 60 : 45))) {
      for (const goal of ['muscle', 'strength', 'general'] as const) {
        const input: GeneratorInput = { goal, days, experience: 'beginner', equipment: 'gym', minutes, split: s.kind };
        const ids = generateProgram(input, 'p').days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
        const missing = parts(MAIN).filter((t) => !coveredBy(ids, t));
        expect({ split: s.kind, days, minutes, goal, missing }).toEqual({ split: s.kind, days, minutes, goal, missing: [] });
      }
    }
  });

  it('counts only a real exercise for a part, not spill-over (flat bench is not a lower chest exercise)', () => {
    expect(covers(MOVE_BY_ID.get('Barbell_Bench_Press_-_Medium_Grip')!, 'chestLower')).toBe(false);
    expect(covers(MOVE_BY_ID.get('Chin-Up')!, 'bicepsShort')).toBe(false);
    expect(covers(MOVE_BY_ID.get('Preacher_Curl')!, 'bicepsShort')).toBe(true);
    const p = generateProgram({ goal: 'muscle', days: 3, experience: 'beginner', equipment: 'gym', minutes: 60, split: 'ppl' }, 'p');
    expect(weekCoverage(p).missing).toEqual([]);
  });

  it('spreads parts across the week when one session has no room for them all', () => {
    // Two upper days at 45 minutes: neither day covers every part of the upper body, the week does.
    const p = generateProgram({ goal: 'muscle', days: 4, experience: 'beginner', equipment: 'gym', minutes: 45, split: 'upperLower' }, 'p');
    const upper = p.days.filter((d) => d.name.startsWith('Upper')).map((d) => d.exercises.map((e) => e.exerciseId));
    const want = parts(['chest', 'delts', 'rearDelts', 'back', 'biceps', 'triceps']);
    expect(want.every((t) => upper.some((ids) => coveredBy(ids, t)))).toBe(true);
  });

  it('covers every part of a push or pull day on its own from 45 minutes, legs from 60', () => {
    const groups: Record<string, Group[]> = { Push: ['chest', 'delts', 'triceps'], Pull: ['back', 'rearDelts', 'biceps'], Legs: ['quads', 'hams', 'calves'] };
    for (const [kind, g] of Object.entries(groups)) for (const minutes of kind === 'Legs' ? [60, 90] : [45, 60, 90]) {
      const p = generateToday({ goal: 'muscle', experience: 'intermediate', equipment: 'gym', minutes, kind }, [], byId, Date.now());
      const ids = p.day.exercises.map((e) => e.exerciseId);
      expect({ kind, minutes, missing: parts(g).filter((t) => !coveredBy(ids, t)) }).toEqual({ kind, minutes, missing: [] });
    }
  });

  it('says what a short single workout had no room for', () => {
    const p = generateToday({ goal: 'muscle', experience: 'intermediate', equipment: 'gym', minutes: 30, kind: 'Upper Body' }, [], byId, Date.now());
    expect(p.leftOut.length).toBeGreaterThan(0);
    const ids = p.day.exercises.map((e) => e.exerciseId);
    for (const t of p.leftOut) expect(coveredBy(ids, t)).toBe(false);
  });

  it('keeps every part when trimming a day to a smaller size, if the smaller size can fit them', () => {
    const p = generateProgram({ goal: 'muscle', days: 3, experience: 'beginner', equipment: 'gym', minutes: 90, split: 'ppl' }, 'p');
    const push = p.days[0];
    const fitted = fitDay({ ...push, exercises: push.exercises.slice(0, -3) }, { size: { kind: 'minutes', n: 60 }, finisher: false });
    const ids = fitted.exercises.map((e) => e.exerciseId);
    expect(parts(['chest', 'delts', 'triceps']).filter((t) => !coveredBy(ids, t))).toEqual([]);
  });
});

describe('splitCatchUp', () => {
  const H = 36e5;
  const NOW = Date.UTC(2026, 10, 26, 8);
  const program: Program = {
    id: 'ppl', name: 'PPL', createdAt: 0,
    days: [{ id: 'push', name: 'Push', exercises: [] }, { id: 'pull', name: 'Pull', exercises: [] }, { id: 'legs', name: 'Legs', exercises: [] }],
  };
  const w = (dayId: string, hoursAgo: number, ids: string[]): Workout => ({
    id: `${dayId}${hoursAgo}`, name: dayId, programId: 'ppl', dayId, startedAt: NOW - hoursAgo * H, finishedAt: NOW - hoursAgo * H + H,
    exercises: ids.map((exerciseId) => ({ exerciseId, repMin: 8, repMax: 12, rest: 90, sets: [{ weight: 50, reps: 10, type: 'working' as const, done: true }] })),
  });
  // A round that never trains lats, traps, forearms or the biceps long head.
  const round = [
    w('push', 72, ['Barbell_Bench_Press_-_Medium_Grip', 'Incline_Dumbbell_Press', 'Cable_Crossover', 'Side_Lateral_Raise', 'Triceps_Overhead_Extension_with_Rope', 'Triceps_Pushdown']),
    w('pull', 48, ['Seated_Cable_Rows', 'Face_Pull', 'Preacher_Curl', 'Hammer_Curls']),
    w('legs', 24, ['Barbell_Squat', 'Leg_Extensions', 'Romanian_Deadlift', 'Seated_Leg_Curl', 'Standing_Calf_Raises', 'Seated_Calf_Raise', 'Thigh_Abductor',
      'Cable_Crunch', 'Hanging_Leg_Raise', 'Pallof_Press', 'Hyperextensions_Back_Extensions']),
  ];

  it('offers a workout for what the round skipped once its last day is done', () => {
    const c = splitCatchUp(program, round, byId, { minutes: 60 })!;
    expect(c.missed).toEqual(expect.arrayContaining(['lats', 'traps', 'forearms', 'bicepsLong']));
    const ids = c.day.exercises.map((e) => e.exerciseId);
    for (const t of c.missed) expect(coveredBy(ids, t)).toBe(true);
    expect(c.day.id).toBe(catchUpDayId('ppl'));
  });

  it('trains traps and forearms in a generated push / pull / legs round or its catch-up', () => {
    for (const equipment of ['gym', 'dumbbells'] as const) for (const minutes of [45, 60, 90]) {
      const p = generateProgram({ goal: 'muscle', days: 3, experience: 'beginner', equipment, minutes, split: 'ppl' }, 'ppl');
      const done = p.days.map((d, i) => w(d.id, 72 - i * 24, d.exercises.map((e) => e.exerciseId)));
      const c = splitCatchUp(p, done, byId, { minutes })!;
      const ids = c.day.exercises.map((e) => e.exerciseId);
      const round = p.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
      const ok = (t: Target) => coveredBy(round, t) || coveredBy(ids, t);
      expect({ equipment, minutes, traps: ok('traps'), forearms: ok('forearms') })
        .toEqual({ equipment, minutes, traps: true, forearms: true });
    }
  });

  it('waits for the last day, and stops offering once the catch-up is done', () => {
    expect(splitCatchUp(program, round.slice(0, 2), byId, { minutes: 60 })).toBeUndefined();
    const catchUp = { ...w('x', 2, ['Wide-Grip_Lat_Pulldown']), dayId: catchUpDayId('ppl') };
    expect(splitCatchUp(program, [...round, catchUp], byId, { minutes: 60 })).toBeUndefined();
  });

  it('counts only the current round, and nothing when the round missed nothing', () => {
    const old = w('pull', 24 * 10, ['Wide-Grip_Lat_Pulldown', 'Barbell_Shrug', 'Incline_Dumbbell_Curl']);
    expect(splitCatchUp(program, [old, ...round], byId, { minutes: 60 })!.missed).toContain('lats');
    const extra = w('pull', 30, ['Wide-Grip_Lat_Pulldown', 'Barbell_Shrug', 'Incline_Dumbbell_Curl', 'Leg_Press']);
    const full = splitCatchUp(program, [...round, { ...extra, dayId: undefined, programId: undefined }], byId, { minutes: 60 });
    expect(full?.missed ?? []).not.toContain('lats');
  });
});
