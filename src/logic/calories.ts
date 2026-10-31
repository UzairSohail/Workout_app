import type { Exercise, LoggedExercise, LoggedSet, Settings, Workout } from '../types';
import { e1rm } from './stats';

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
 * whole session including rests (that's how the Compendium measured them), not just the seconds under load.
 * Resistance training runs from light effort (≈3.5) to vigorous (≈6), so each set lands between its
 * exercise's light and heavy value by how heavy the weight is for that person. Circuit cardio ≈ 7.
 */
const MET = { compound: [3.5, 6], isolation: [3, 5], cardio: [7, 7] } as const;
/**
 * Show active calories, like a watch does: the 1 MET you'd burn sitting still anyway is left out.
 * Without this the total also counts resting metabolism and reads high.
 */
const RESTING_MET = 1;
/** A gap longer than this between ticked sets (a chat, a phone call) only counts up to this much. */
const MAX_GAP = 5 * 60_000;
/** Without per-set times (older workouts), assume this much time per set, capped by the session length. */
const PER_SET = 3 * 60_000;

/** [light, heavy] MET for an exercise. */
export function exerciseMet(ex: Exercise | undefined): readonly [number, number] {
  if (ex?.category === 'cardio') return MET.cardio;
  return ex?.mechanic === 'compound' ? MET.compound : MET.isolation;
}

const setE1rm = (e: LoggedExercise, s: LoggedSet) => (e.mode === 'time' || !s.done ? 0 : e1rm(s.weight ?? 0, s.reps ?? 0));

/** Each exercise's best estimated one-rep max across these workouts. */
function bestE1rms(workouts: Workout[]): Map<string, number> {
  const best = new Map<string, number>();
  for (const w of workouts) {
    for (const e of w.exercises) {
      for (const s of e.sets) best.set(e.exerciseId, Math.max(best.get(e.exerciseId) ?? 0, setE1rm(e, s)));
    }
  }
  return best;
}

/**
 * How heavy a set is for this person, 0 (light) to 1 (heavy): the weight as a share of their best estimated
 * one-rep max, from 50% (light) to 100%. A set of 10 at their best is about 75%, so it lands halfway; a heavy
 * triple counts more. Bodyweight and timed sets, with no weight to compare, also count as halfway.
 */
function effort(s: LoggedSet, est: number, top: number): number {
  if (!est || !top) return 0.5;
  return Math.min(1, Math.max(0, ((s.weight ?? 0) / top - 0.5) / 0.5));
}

interface TimedSet { e: LoggedExercise; s: LoggedSet; ms: number }

/**
 * The done sets in the order they were ticked, each with the training time it gets credit for: the time
 * since the previous tick (the set itself and the rest before it), with long pauses trimmed.
 */
function timedSets(w: Workout, now: number): TimedSet[] {
  const done = w.exercises.flatMap((e) => e.sets.filter((s) => s.done).map((s) => ({ e, s })));
  if (!done.length) return [];
  if (!done.some(({ s }) => s.doneAt != null)) {
    // Older workouts have no set times: share the session evenly, at most 3 minutes a set.
    const total = Math.max(0, Math.min(done.length * PER_SET, (w.finishedAt ?? now) - w.startedAt));
    return done.map((d) => ({ ...d, ms: total / done.length }));
  }
  let prev = w.startedAt;
  return done
    .filter(({ s }) => s.doneAt != null)
    .sort((a, b) => a.s.doneAt! - b.s.doneAt!)
    .map((d) => {
      const ms = Math.min(MAX_GAP, Math.max(0, d.s.doneAt! - prev));
      prev = d.s.doneAt!;
      return { ...d, ms };
    });
}

/** Training time so far: from the start to the last ticked set, with long pauses trimmed. */
export function activeMs(w: Workout, now = Date.now()): number {
  return timedSets(w, now).reduce((a, t) => a + t.ms, 0);
}

/**
 * Estimated active calories: each set adds (MET − 1) × resting kcal per hour × the hours it took, so
 * ticking a set only ever adds to the total. `history` is the person's other workouts, used to judge how
 * heavy each set is for them; a set is compared only with what came before it, so a later, heavier set
 * doesn't make earlier ones count for less.
 */
export function workoutCalories(
  w: Workout, byId: Map<string, Exercise>, profile: Profile, history: Workout[] = [], now = Date.now(),
): number {
  const best = bestE1rms(history);
  const perHour = restingKcalPerHour(profile, now);
  let kcal = 0;
  for (const { e, s, ms } of timedSets(w, now)) {
    const [light, heavy] = exerciseMet(byId.get(e.exerciseId));
    const est = setE1rm(e, s);
    const top = Math.max(best.get(e.exerciseId) ?? 0, est);
    best.set(e.exerciseId, top);
    const met = light + (heavy - light) * effort(s, est, top);
    kcal += Math.max(0, met - RESTING_MET) * perHour * (ms / 3600_000);
  }
  return Math.round(kcal);
}
