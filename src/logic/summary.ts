import type { Workout } from '../types';
import { countedSets, workoutVolume } from './stats';

/** The last finished workout before `w` of the same program day, or else with the same name. */
export function previousLike(w: Workout, finished: Workout[]): Workout | undefined {
  const before = finished
    .filter((x) => x.id !== w.id && x.finishedAt && x.startedAt < w.startedAt)
    .sort((a, b) => b.startedAt - a.startedAt);
  if (w.programId && w.dayId) {
    const same = before.find((x) => x.programId === w.programId && x.dayId === w.dayId);
    if (same) return same;
  }
  const name = w.name.trim().toLowerCase();
  return name ? before.find((x) => x.name.trim().toLowerCase() === name) : undefined;
}

export const workingSets = (w: Workout) => w.exercises.reduce((a, e) => a + countedSets(e.sets).length, 0);
export const durationMs = (w: Workout) => (w.finishedAt ?? w.startedAt) - w.startedAt;

export interface Change { now: number; before: number; diff: number; pct: number | null }

const change = (now: number, before: number): Change => ({
  now, before, diff: now - before, pct: before > 0 ? Math.round(((now - before) / before) * 100) : null,
});

export interface Comparison {
  prev: Workout;
  volume: Change;
  sets: Change;
  duration: Change;
}

export function compareWorkouts(w: Workout, prev: Workout): Comparison {
  return {
    prev,
    volume: change(workoutVolume(w), workoutVolume(prev)),
    sets: change(workingSets(w), workingSets(prev)),
    duration: change(durationMs(w), durationMs(prev)),
  };
}
