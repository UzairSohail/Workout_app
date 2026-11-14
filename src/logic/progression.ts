import type { LoggedExercise, Units } from '../types';
import { countedSets } from './stats';
import { fmt, fromDisplay, roundTo, toDisplay } from './units';

export type SuggestionKind = 'new' | 'increase' | 'hold' | 'deload';

export interface Suggestion {
  kind: SuggestionKind;
  /** kg, or null when there is nothing to base it on (or bodyweight). */
  weight: number | null;
  reps: number;
  message: string;
}

/**
 * Double progression with a scale-back:
 *  - every working set at the top weight hit repMax  -> add one increment
 *  - any set at the top weight fell short of repMin   -> scale back: to the last lighter weight where
 *    every set reached repMin, or one increment down (10% if the reps were far off). Each miss steps down
 *    again, so it keeps coming down until every set is done, and only goes up again once every set hits repMax.
 *  - otherwise keep the weight and aim for one more rep
 *
 * @param history  this exercise's previous sessions, most recent first
 * @param increment weight step in display units
 */
export function suggest(
  history: LoggedExercise[],
  repMin: number,
  repMax: number,
  increment: number,
  units: Units,
  /** kg estimate for a first session, from the user's profile. */
  start?: number | null,
): Suggestion {
  const sessions = history.map((h) => countedSets(h.sets)).filter((s) => s.length > 0);
  if (sessions.length === 0) {
    if (start) {
      return {
        kind: 'new', weight: start, reps: repMin,
        message: `Suggested start: ${fmt(toDisplay(start, units))} ${units}, based on your profile. Too light or too heavy? Change it and the app adjusts next time.`,
      };
    }
    return { kind: 'new', weight: null, reps: repMin, message: `First time: pick a weight you can do for ${repMin}–${repMax} reps.` };
  }
  const last = sessions[0];
  const feel = history.find((h) => countedSets(h.sets).length > 0)?.feel;
  const top = Math.max(...last.map((s) => s.weight));
  const topSets = last.filter((s) => s.weight === top);
  const minReps = Math.min(...topSets.map((s) => s.reps));

  if (top <= 0) {
    // Bodyweight movement: progress reps.
    if (minReps >= repMax) {
      return { kind: 'increase', weight: null, reps: repMax, message: `You hit ${repMax}+ on every set. Add weight or move to a harder variation.` };
    }
    if (feel === 'easy') {
      const t = Math.min(repMax, minReps + 2);
      return { kind: 'hold', weight: null, reps: t, message: `Last time felt easy. Aim for ${t} reps on each set.` };
    }
    if (feel === 'hard') {
      return { kind: 'hold', weight: null, reps: Math.max(repMin, minReps), message: `Last time felt hard. Match ${Math.max(repMin, minReps)} reps on each set again.` };
    }
    return { kind: 'hold', weight: null, reps: Math.min(repMax, minReps + 1), message: `Aim for ${Math.min(repMax, minReps + 1)} reps on each set.` };
  }

  const topDisplay = toDisplay(top, units);
  if (minReps >= repMax && feel === 'hard') {
    return {
      kind: 'hold',
      weight: top,
      reps: repMax,
      message: `You hit ${repMax} reps, but it felt hard. Stay at ${fmt(topDisplay)} ${units} until it feels solid, then go up.`,
    };
  }

  if (minReps >= repMax || (feel === 'easy' && minReps >= repMin)) {
    const next = roundTo(topDisplay + increment, increment);
    if (minReps < repMax) {
      return {
        kind: 'increase',
        weight: fromDisplay(next, units),
        reps: repMin,
        message: `Last time felt easy at ${fmt(topDisplay)} ${units}. Go up to ${fmt(next)} ${units}.`,
      };
    }
    return {
      kind: 'increase',
      weight: fromDisplay(next, units),
      reps: repMin,
      message: `You hit ${repMax} reps on every set. Go up to ${fmt(next)} ${units}.`,
    };
  }

  if (minReps < repMin) {
    const next = scaleBack(sessions.slice(1, 6), top, minReps, repMin, increment, units);
    return {
      kind: 'deload',
      weight: fromDisplay(next, units),
      reps: repMin,
      message: `${minReps} reps at ${fmt(topDisplay)} ${units} is under ${repMin}. Drop back to ${fmt(next)} ${units}, and the weight goes up again once you get ${repMax} on every set.`,
    };
  }

  // A hard session: match those reps again before adding one.
  const target = Math.min(repMax, Math.max(repMin, feel === 'hard' ? minReps : minReps + 1));
  return {
    kind: 'hold',
    weight: top,
    reps: target,
    message: feel === 'hard'
      ? `Last time felt hard. Stay at ${fmt(topDisplay)} ${units} and match ${target} reps per set.`
      : `Stay at ${fmt(topDisplay)} ${units} and aim for ${target} reps per set.`,
  };
}

/**
 * Where to go after missing reps at `top` (kg): the most recent lighter weight in the last few sessions at
 * which every set reached repMin, or else one increment below (about 10% below when the reps were far off).
 * Returns display units.
 */
function scaleBack(
  earlier: { weight: number; reps: number }[][],
  top: number,
  minReps: number,
  repMin: number,
  increment: number,
  units: Units,
): number {
  const topDisplay = toDisplay(top, units);
  const oneDown = roundTo(topDisplay - increment, increment);
  for (const s of earlier) {
    const w = Math.max(...s.map((x) => x.weight));
    if (w <= 0 || w >= top) continue;
    if (s.filter((x) => x.weight === w).every((x) => x.reps >= repMin)) {
      return Math.min(oneDown, roundTo(toDisplay(w, units), increment));
    }
  }
  const farOff = minReps < repMin * 0.6;
  const next = farOff ? Math.min(oneDown, roundTo(topDisplay * 0.9, increment)) : oneDown;
  return Math.max(increment, next);
}
