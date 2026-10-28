import type { Exercise, LoggedSet, Settings, Workout } from '../types';

/** Used when no body weight is set in Settings. */
export const DEFAULT_BODY_KG = 70;
/** Used when no year of birth is set. */
const DEFAULT_AGE = 30;

export type Profile = Pick<Settings, 'bodyWeight' | 'height' | 'sex' | 'birthYear'>;

/**
 * Resting burn in kcal per hour. 1 MET is defined as 1 kcal/kg/h, which fits an average 70 kg adult but
 * overstates it for women and shorter or older people. With a height, use the Mifflin-St Jeor BMR
 * instead (weight, height, age and sex), which is what MET values are corrected by for a given person.
 */
export function restingKcalPerHour(p: Profile, now = Date.now()): number {
  const kg = p.bodyWeight || DEFAULT_BODY_KG;
  if (!p.height) return kg;
  const age = p.birthYear ? new Date(now).getFullYear() - p.birthYear : DEFAULT_AGE;
  // Men +5, women −161; with no sex set, halfway between.
  const offset = p.sex === 'male' ? 5 : p.sex === 'female' ? -161 : -78;
  return Math.max(0, 10 * kg + 6.25 * p.height - 5 * age + offset) / 24;
}

/**
 * MET values from the 2024 Compendium of Physical Activities. Like Fitbod and Hevy, they're applied to the
 * whole session including rests (that's how the Compendium measured them), not just the seconds under load:
 * resistance training, multiple exercises 8–15 reps ≈ 3.5; heavy compound work ≈ 4.5; circuit-style cardio ≈ 7.
 */
const MET = { compound: 4.5, isolation: 3.5, cardio: 7 } as const;
/**
 * Show active calories, like a watch does: the 1 MET you'd burn sitting still anyway is left out.
 * Without this the total also counts resting metabolism and reads high.
 */
const RESTING_MET = 1;
/** A gap longer than this between ticked sets (a chat, a phone call) only counts up to this much. */
const MAX_GAP = 5 * 60_000;
/** Without per-set times (older workouts), assume this much time per set, capped by the session length. */
const PER_SET = 3 * 60_000;

export function exerciseMet(ex: Exercise | undefined): number {
  if (ex?.category === 'cardio') return MET.cardio;
  return ex?.mechanic === 'compound' ? MET.compound : MET.isolation;
}

/** Training time so far: from the start to the last ticked set, with long pauses trimmed. */
export function activeMs(w: Workout, now = Date.now()): number {
  const sets = w.exercises.flatMap((e) => e.sets).filter((s) => s.done);
  if (!sets.length) return 0;
  const times = sets.map((s) => s.doneAt).filter((t): t is number => t != null).sort((a, b) => a - b);
  if (!times.length) return Math.max(0, Math.min(sets.length * PER_SET, (w.finishedAt ?? now) - w.startedAt));
  let total = 0;
  let prev = w.startedAt;
  for (const t of times) {
    total += Math.min(MAX_GAP, Math.max(0, t - prev));
    prev = t;
  }
  return total;
}

/** Average intensity of the sets done, warm-ups counting half. */
function sessionMet(w: Workout, byId: Map<string, Exercise>): number {
  let sum = 0;
  let n = 0;
  for (const e of w.exercises) {
    const met = exerciseMet(byId.get(e.exerciseId));
    for (const s of e.sets as LoggedSet[]) {
      if (!s.done) continue;
      const weight = s.type === 'warmup' ? 0.5 : 1;
      sum += met * weight;
      n += weight;
    }
  }
  return n ? Math.max(0, sum / n - RESTING_MET) : 0;
}

/**
 * Estimated active calories: (MET − 1) × resting kcal per hour × hours of training.
 * Grows each time a set is ticked off.
 */
export function workoutCalories(w: Workout, byId: Map<string, Exercise>, profile: Profile, now = Date.now()): number {
  const hours = activeMs(w, now) / 3600_000;
  return Math.round(sessionMet(w, byId) * restingKcalPerHour(profile, now) * hours);
}
