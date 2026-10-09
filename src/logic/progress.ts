import type { Exercise, Workout } from '../types';
import { countedSets, workoutVolume } from './stats';

const DAY = 864e5;

/** Local midnight on the Monday of t's week. */
export function weekStart(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export interface WeekSummary { start: number; workouts: number; volume: number; sets: number }

/** The last `weeks` weeks (oldest first), including empty ones. */
export function weeklySummary(workouts: Workout[], weeks = 12, now = Date.now()): WeekSummary[] {
  const current = weekStart(now);
  const out: WeekSummary[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    // Step back by whole days so DST changes don't shift the boundary.
    const d = new Date(current);
    d.setDate(d.getDate() - 7 * i);
    out.push({ start: d.getTime(), workouts: 0, volume: 0, sets: 0 });
  }
  for (const w of workouts) {
    if (!w.finishedAt) continue;
    const ws = weekStart(w.startedAt);
    const bucket = out.find((b) => b.start === ws);
    if (!bucket) continue;
    bucket.workouts++;
    bucket.volume += workoutVolume(w);
    bucket.sets += w.exercises.reduce((a, e) => a + countedSets(e.sets).length, 0);
  }
  return out;
}

/** Working sets per primary muscle since `since`, highest first. */
export function setsPerMuscle(workouts: Workout[], byId: Map<string, Exercise>, since: number): [string, number][] {
  const counts = new Map<string, number>();
  for (const w of workouts) {
    if (!w.finishedAt || w.startedAt < since) continue;
    for (const e of w.exercises) {
      const n = countedSets(e.sets).length;
      if (!n) continue;
      for (const m of byId.get(e.exerciseId)?.primaryMuscles ?? []) counts.set(m, (counts.get(m) ?? 0) + n);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/** Current streak of consecutive weeks (ending this or last week) with at least one workout. */
export function weekStreak(weeks: WeekSummary[]): number {
  let i = weeks.length - 1;
  if (i >= 0 && weeks[i].workouts === 0) i--; // this week isn't over yet
  let n = 0;
  for (; i >= 0 && weeks[i].workouts > 0; i--) n++;
  return n;
}

export const daysAgo = (n: number, now = Date.now()) => now - n * DAY;
