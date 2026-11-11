import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Exercise, Workout } from '../types';
import { estimateMinutes, generateToday, isFinisherMove, SESSION_MINUTES, type TodayInput } from './generator';
import { groupCredit, MOVE_BY_ID, type Group } from './targets';

const library: Exercise[] = JSON.parse(readFileSync(new URL('../../public/exercises.json', import.meta.url), 'utf8'));
const byId = new Map(library.map((e) => [e.id, e]));
const input: TodayInput = { goal: 'muscle', experience: 'intermediate', equipment: 'gym', minutes: 60 };
const NOW = Date.UTC(2026, 10, 10, 18);
const H = 36e5;

const done = (exerciseId: string, n: number, weight = 50) => ({
  exerciseId, repMin: 8, repMax: 12, rest: 90,
  sets: Array.from({ length: n }, () => ({ weight, reps: 10, type: 'working' as const, done: true })),
});
const workout = (hoursAgo: number, ...ex: ReturnType<typeof done>[]): Workout => ({
  id: `w${hoursAgo}`, name: 'w', startedAt: NOW - hoursAgo * H, finishedAt: NOW - hoursAgo * H + H, exercises: ex,
});
const mainIds = (p: ReturnType<typeof generateToday>) => p.day.exercises.map((e) => e.exerciseId).filter((id) => !isFinisherMove(MOVE_BY_ID.get(id)!));
const mainGroups = (p: ReturnType<typeof generateToday>) =>
  new Set(mainIds(p).flatMap((id) => [...groupCredit(MOVE_BY_ID.get(id)!)].filter(([, c]) => c === 1).map(([g]) => g)));

const push = workout(20, done('Barbell_Bench_Press_-_Medium_Grip', 4), done('Incline_Dumbbell_Press', 4),
  done('Side_Lateral_Raise', 4), done('Triceps_Pushdown', 4), done('Dumbbell_Shoulder_Press', 3));

describe('generateToday', () => {
  it('builds a full-body day with no history, sized to the session, with the core finisher', () => {
    for (const minutes of SESSION_MINUTES) {
      const p = generateToday({ ...input, minutes }, [], byId, NOW);
      expect(p.kind).toBe('Full Body');
      expect(estimateMinutes(p.day)).toBeLessThanOrEqual(minutes);
      expect(mainIds(p).length).toBeGreaterThanOrEqual(2);
      expect(p.day.exercises.slice(-3).every((e) => isFinisherMove(MOVE_BY_ID.get(e.exerciseId)!))).toBe(true);
      expect(new Set(p.day.exercises.map((e) => e.exerciseId)).size).toBe(p.day.exercises.length);
    }
  });

  it('rests muscles trained hard in the last two days', () => {
    for (const id of push.exercises.map((e) => e.exerciseId)) expect(MOVE_BY_ID.has(id)).toBe(true);
    const p = generateToday(input, [push], byId, NOW);
    const groups = mainGroups(p);
    for (const g of ['chest', 'delts', 'triceps'] as Group[]) expect(groups.has(g)).toBe(false);
    expect(p.resting).toEqual(expect.arrayContaining(['chest', 'delts', 'triceps']));
    expect(['Pull', 'Lower Body']).toContain(p.kind);
  });

  it('trains them again once they have recovered', () => {
    const pull = workout(50, done('Wide-Grip_Lat_Pulldown', 5), done('Seated_Cable_Rows', 5), done('Barbell_Curl', 5), done('Hammer_Curls', 4), done('Face_Pull', 5), done('Reverse_Flyes', 4));
    const legs = workout(26, done('Barbell_Squat', 4), done('Romanian_Deadlift', 4), done('Leg_Extensions', 3), done('Standing_Calf_Raises', 4), done('Barbell_Hip_Thrust', 3));
    const p = generateToday(input, [{ ...push, startedAt: NOW - 80 * H, finishedAt: NOW - 79 * H }, pull, legs], byId, NOW);
    expect(p.resting).not.toContain('chest');
    expect(p.resting).toContain('quads');
    expect(mainGroups(p).has('chest')).toBe(true);
  });

  it('goes for the muscles furthest behind on the week', () => {
    // Upper body three days ago, legs untouched all week: today is a lower day.
    const upper = workout(72, done('Barbell_Bench_Press_-_Medium_Grip', 4), done('Wide-Grip_Lat_Pulldown', 4),
      done('Side_Lateral_Raise', 3), done('Barbell_Curl', 3), done('Triceps_Pushdown', 3), done('Seated_Cable_Rows', 4));
    for (const id of upper.exercises.map((e) => e.exerciseId)) expect(MOVE_BY_ID.has(id)).toBe(true);
    expect(generateToday(input, [upper], byId, NOW).kind).toBe('Lower Body');
  });

  it('prefers lifts you already know', () => {
    const fresh = generateToday(input, [], byId, NOW);
    const alt = MOVE_BY_ID.get('Dumbbell_Bench_Press');
    expect(alt).toBeDefined();
    // Done two weeks ago, so it's familiar but not recent.
    const old = workout(24 * 14, done('Dumbbell_Bench_Press', 3));
    const p = generateToday(input, [old], byId, NOW);
    expect(mainIds(fresh)).not.toContain('Dumbbell_Bench_Press');
    expect(mainIds(p)).toContain('Dumbbell_Bench_Press');
  });

  it('suggests a rest day when everything is still recovering', () => {
    const all = workout(10, ...['Barbell_Squat', 'Romanian_Deadlift', 'Barbell_Bench_Press_-_Medium_Grip', 'Wide-Grip_Lat_Pulldown',
      'Side_Lateral_Raise', 'Barbell_Curl', 'Triceps_Pushdown', 'Seated_Cable_Rows', 'Face_Pull', 'Standing_Calf_Raises', 'Barbell_Hip_Thrust']
      .map((id) => done(id, 6)));
    expect(generateToday(input, [all], byId, NOW).restDay).toBe(true);
  });
});
