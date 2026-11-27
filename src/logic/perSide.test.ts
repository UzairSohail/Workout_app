import { describe, expect, it } from 'vitest';
import { defaultPerSide, withSide } from './session';
import { workoutVolume } from './stats';
import type { Exercise, LoggedExercise, Workout } from '../types';

const ex = (name: string) => ({ id: name, name, category: 'strength', equipment: 'dumbbell', primaryMuscles: [], secondaryMuscles: [], instructions: [], images: [] }) as Exercise;

describe('per-side logging', () => {
  it('guesses single-arm and single-leg work', () => {
    for (const n of ['One-Arm Dumbbell Row', 'Single-Leg Romanian Deadlift', 'Bulgarian Split Squat', 'Dumbbell Lunges', 'Dumbbell Step Ups', 'TRX Side Plank', 'Alternate Hammer Curl'])
      expect(defaultPerSide(ex(n)), n).toBe(true);
    for (const n of ['Barbell Squat', 'Dumbbell Bench Press', 'Lat Pulldown', 'Plank'])
      expect(defaultPerSide(ex(n)), n).toBe(false);
  });
  it('lets the saved choice win', () => {
    expect(defaultPerSide(ex('Dumbbell Lunges'), false)).toBe(false);
    expect(defaultPerSide(ex('Barbell Squat'), true)).toBe(true);
    const le: LoggedExercise = { exerciseId: 'x', repMin: 8, repMax: 12, rest: 60, sets: [] };
    expect(withSide(le, ex('Single-Arm Cable Row')).perSide).toBe(true);
    expect(withSide(le, ex('Single-Arm Cable Row'), false).perSide).toBeUndefined();
  });
  it('counts both sides in workout volume', () => {
    const set = { weight: 20, reps: 10, type: 'working' as const, done: true };
    const w = { id: 'w', name: '', startedAt: 0, exercises: [
      { exerciseId: 'a', repMin: 8, repMax: 12, rest: 60, sets: [set] },
      { exerciseId: 'b', repMin: 8, repMax: 12, rest: 60, sets: [set], perSide: true },
    ] } as Workout;
    expect(workoutVolume(w)).toBe(200 + 400);
  });
});
