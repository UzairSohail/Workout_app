import type { Exercise, LoggedExercise, LoggedSet, Workout } from '../types';

/** Used when no body weight is set in Settings. */
export const DEFAULT_BODY_KG = 70;

// MET values from the Compendium of Physical Activities: vigorous lifting ~6, light effort between sets ~2.5.
const MET = { compound: 7, isolation: 5, cardio: 8, rest: 2.5 } as const;
const SECONDS_PER_REP = 3;
/** Rest beyond this isn't counted, so a long chat between sets doesn't inflate the total. */
const MAX_REST = 180;

const kcal = (met: number, kg: number, seconds: number) => (met * kg * seconds) / 3600;

/** Estimated calories for one finished set, including the rest that follows it. */
export function setCalories(set: LoggedSet, le: LoggedExercise, ex: Exercise | undefined, kg: number): number {
  if (!set.done || !set.reps) return 0;
  const timed = le.mode === 'time';
  const work = timed ? set.reps : set.reps * SECONDS_PER_REP;
  const met = ex?.category === 'cardio' ? MET.cardio : ex?.mechanic === 'compound' ? MET.compound : MET.isolation;
  // Superset partners go straight to the next exercise, so there's no rest after them.
  const rest = le.supersetWithNext ? 0 : Math.min(MAX_REST, set.type === 'warmup' ? Math.min(60, le.rest) : le.rest);
  return kcal(set.type === 'warmup' ? met * 0.7 : met, kg, work) + kcal(MET.rest, kg, rest);
}

export function workoutCalories(w: Workout, byId: Map<string, Exercise>, kg: number | undefined): number {
  const body = kg || DEFAULT_BODY_KG;
  let total = 0;
  for (const le of w.exercises) for (const s of le.sets) total += setCalories(s, le, byId.get(le.exerciseId), body);
  return Math.round(total);
}
