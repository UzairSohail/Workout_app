import type { LoggedSet, Workout } from '../types';

export const LOWER_BODY = new Set([
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors', 'lower back',
]);

/** Epley estimated one-rep max. */
export function e1rm(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Completed, non-warm-up sets with both numbers entered. */
export function countedSets(sets: LoggedSet[]): { weight: number; reps: number }[] {
  return sets
    .filter((s) => s.done && s.type !== 'warmup' && s.reps != null && s.reps > 0)
    .map((s) => ({ weight: s.weight ?? 0, reps: s.reps! }));
}

export function setVolume(sets: LoggedSet[]): number {
  return countedSets(sets).reduce((acc, s) => acc + s.weight * s.reps, 0);
}

export function workoutVolume(w: Workout): number {
  return w.exercises.reduce((acc, e) => acc + setVolume(e.sets), 0);
}

export interface Records {
  maxWeight: number;
  maxWeightReps: number;
  bestE1rm: number;
  maxReps: number;
  maxVolume: number;
  maxWeightDate?: number;
  bestE1rmDate?: number;
  maxRepsDate?: number;
  maxVolumeDate?: number;
}

export const emptyRecords = (): Records => ({
  maxWeight: 0, maxWeightReps: 0, bestE1rm: 0, maxReps: 0, maxVolume: 0,
});

/** Personal records for one exercise across the given (finished) workouts. */
export function recordsFor(exerciseId: string, workouts: Workout[]): Records {
  const r = emptyRecords();
  for (const w of workouts) {
    for (const e of w.exercises) {
      if (e.exerciseId !== exerciseId) continue;
      const sets = countedSets(e.sets);
      for (const s of sets) {
        if (s.weight > r.maxWeight || (s.weight === r.maxWeight && s.reps > r.maxWeightReps)) {
          r.maxWeight = s.weight;
          r.maxWeightReps = s.reps;
          r.maxWeightDate = w.startedAt;
        }
        const est = e1rm(s.weight, s.reps);
        if (est > r.bestE1rm) {
          r.bestE1rm = est;
          r.bestE1rmDate = w.startedAt;
        }
        if (s.reps > r.maxReps) {
          r.maxReps = s.reps;
          r.maxRepsDate = w.startedAt;
        }
      }
      const vol = sets.reduce((a, s) => a + s.weight * s.reps, 0);
      if (vol > r.maxVolume) {
        r.maxVolume = vol;
        r.maxVolumeDate = w.startedAt;
      }
    }
  }
  return r;
}

export type PrKind = 'weight' | 'e1rm' | 'reps';

/**
 * Which records a single set beats, compared with previous records.
 * A first-ever set is not counted as a PR. Bodyweight sets only count rep PRs.
 */
export function setPrs(set: LoggedSet, prev: Records, hasHistory: boolean): PrKind[] {
  if (!hasHistory || !set.done || set.type === 'warmup' || !set.reps) return [];
  const weight = set.weight ?? 0;
  const out: PrKind[] = [];
  if (weight > 0) {
    if (weight > prev.maxWeight + 1e-9) out.push('weight');
    if (e1rm(weight, set.reps) > prev.bestE1rm + 1e-9) out.push('e1rm');
  } else if (set.reps > prev.maxReps) {
    out.push('reps');
  }
  return out;
}

/**
 * PRs for each set of one exercise in a session. Records are raised as the session goes,
 * so a set only counts if it beats both history and the earlier sets of the same session.
 */
export function sessionPrs(sets: LoggedSet[], prev: Records, hasHistory: boolean): PrKind[][] {
  const r = { ...prev };
  return sets.map((s) => {
    const prs = setPrs(s, r, hasHistory);
    if (s.done && s.type !== 'warmup' && s.reps) {
      const weight = s.weight ?? 0;
      r.maxWeight = Math.max(r.maxWeight, weight);
      r.bestE1rm = Math.max(r.bestE1rm, e1rm(weight, s.reps));
      if (weight <= 0) r.maxReps = Math.max(r.maxReps, s.reps);
    }
    return prs;
  });
}
