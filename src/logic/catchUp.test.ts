import { describe, expect, it } from 'vitest';
import type { LoggedExercise, PlannedExercise, Workout } from '../types';
import { applyCatchUp, lastSimilar, missedTargets } from './catchUp';
import { generateProgram } from './generator';

const plan = (...ids: string[]): PlannedExercise[] => ids.map((exerciseId) => ({ exerciseId, sets: 3, repMin: 8, repMax: 12, rest: 90 }));
const done = (exerciseId: string, doneSets = 3): LoggedExercise => ({
  exerciseId, repMin: 8, repMax: 12, rest: 90,
  sets: Array.from({ length: 3 }, (_, i) => ({ weight: 20, reps: 10, type: 'working' as const, done: i < doneSets })),
});
const workout = (name: string, startedAt: number, ...exercises: LoggedExercise[]): Workout =>
  ({ id: name + startedAt, name, startedAt, finishedAt: startedAt + 1, exercises });

const push = plan('Barbell_Bench_Press_-_Medium_Grip', 'Incline_Dumbbell_Press', 'Dips_-_Chest_Version', 'Dumbbell_Shoulder_Press',
  'Triceps_Pushdown_-_Rope_Attachment', 'Triceps_Overhead_Extension_with_Rope', 'Side_Lateral_Raise');

describe('catch-up', () => {
  it('finds the last workout of the same kind, not just the last workout', () => {
    const lastPush = workout('Push', 1, done('Barbell_Bench_Press_-_Medium_Grip'), done('Side_Lateral_Raise'));
    const pull = workout('Pull', 2, done('Wide-Grip_Lat_Pulldown'), done('Barbell_Curl'), done('Seated_Cable_Rows'));
    expect(lastSimilar(push, [pull, lastPush])?.name).toBe('Push');
  });

  it('sees skipped exercises as missed areas', () => {
    // Incline press was planned but no set ticked.
    const last = workout('Push', 1, done('Barbell_Bench_Press_-_Medium_Grip'), done('Incline_Dumbbell_Press', 0), done('Dips_-_Chest_Version'),
      done('Dumbbell_Shoulder_Press'), done('Triceps_Overhead_Extension_with_Rope'), done('Side_Lateral_Raise'));
    expect(missedTargets(push, last)).toEqual(['chestUpper']);
  });

  it('moves the exercise for a missed area to the front', () => {
    const out = applyCatchUp(push, ['chestUpper'], 'Push');
    expect(out[0]).toMatchObject({ exerciseId: 'Incline_Dumbbell_Press', catchUpNote: 'Moved up: upper chest missed on your last Push' });
    expect(out.map((p) => p.exerciseId).slice(1)).toEqual(push.map((p) => p.exerciseId).filter((id) => id !== 'Incline_Dumbbell_Press'));
  });

  it('moves isolation work ahead of other isolation, not ahead of the big lifts', () => {
    const out = applyCatchUp(push, ['tricepsLong'], 'Push').map((p) => p.exerciseId);
    expect(out.slice(0, 5)).toEqual(['Barbell_Bench_Press_-_Medium_Grip', 'Incline_Dumbbell_Press', 'Dips_-_Chest_Version', 'Dumbbell_Shoulder_Press', 'Triceps_Overhead_Extension_with_Rope']);
  });

  it('adds one exercise when nothing planned trains the missed area, with kit the plan already uses', () => {
    const dbPush = plan('Dumbbell_Bench_Press', 'Dumbbell_Shoulder_Press', 'Side_Lateral_Raise');
    const out = applyCatchUp(dbPush, ['chestUpper', 'tricepsLong'], 'Push A');
    expect(out).toHaveLength(4);
    const added = out.find((p) => p.catchUpNote?.startsWith('Added'))!;
    expect(added.exerciseId).toBe('Incline_Dumbbell_Press');
    expect(out[0].exerciseId).toBe('Incline_Dumbbell_Press');
    expect(added.catchUpNote).toBe('Added: upper chest missed on your last Push A');
  });

  it('respects missing equipment when adding', () => {
    const out = applyCatchUp(plan('Barbell_Bench_Press_-_Medium_Grip'), ['chestUpper'], 'Push', (id) => !id.includes('Dumbbell'));
    expect(out.map((p) => p.exerciseId)).not.toContain('Incline_Dumbbell_Press');
    expect(out).toHaveLength(2);
  });

  it('changes nothing after a complete workout of a generated routine', () => {
    const p = generateProgram({ goal: 'muscle', days: 3, experience: 'intermediate', equipment: 'gym', minutes: 60 }, 'p');
    const day = p.days[0];
    const last = workout(day.name, 1, ...day.exercises.map((e) => done(e.exerciseId)));
    expect(missedTargets(day.exercises, last)).toEqual([]);
    expect(applyCatchUp(day.exercises, [], day.name)).toEqual(day.exercises);
  });

  it('does nothing without a previous similar workout', () => {
    expect(missedTargets(push, undefined)).toEqual([]);
  });
});
