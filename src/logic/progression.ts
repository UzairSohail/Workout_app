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
 * Double progression:
 *  - every working set at the top weight hit repMax  -> add one increment
 *  - fell below repMin at the same weight in the last two sessions -> deload 10%
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
  const top = Math.max(...last.map((s) => s.weight));
  const topSets = last.filter((s) => s.weight === top);
  const minReps = Math.min(...topSets.map((s) => s.reps));

  if (top <= 0) {
    // Bodyweight movement: progress reps.
    if (minReps >= repMax) {
      return { kind: 'increase', weight: null, reps: repMax, message: `You hit ${repMax}+ on every set. Add weight or move to a harder variation.` };
    }
    return { kind: 'hold', weight: null, reps: Math.min(repMax, minReps + 1), message: `Aim for ${Math.min(repMax, minReps + 1)} reps on each set.` };
  }

  const topDisplay = toDisplay(top, units);
  if (minReps >= repMax) {
    const next = roundTo(topDisplay + increment, increment);
    return {
      kind: 'increase',
      weight: fromDisplay(next, units),
      reps: repMin,
      message: `You hit ${repMax} reps on every set. Go up to ${fmt(next)} ${units}.`,
    };
  }

  const missed = (s: { weight: number; reps: number }[]) =>
    s.some((x) => x.weight === top && x.reps < repMin);
  if (sessions.length >= 2 && missed(last) && missed(sessions[1])) {
    const next = roundTo(topDisplay * 0.9, increment);
    return {
      kind: 'deload',
      weight: fromDisplay(next, units),
      reps: repMax,
      message: `Below ${repMin} reps twice in a row. Drop to ${fmt(next)} ${units} and build back up.`,
    };
  }

  const target = Math.min(repMax, Math.max(repMin, minReps + 1));
  return {
    kind: 'hold',
    weight: top,
    reps: target,
    message: `Stay at ${fmt(topDisplay)} ${units} and aim for ${target} reps per set.`,
  };
}
