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

/** Local calendar day key, e.g. "2026-9-7" (month is 0-based). */
export const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** Finished workouts grouped by local day. */
export function workoutsByDay(workouts: Workout[]): Map<string, Workout[]> {
  const m = new Map<string, Workout[]>();
  for (const w of workouts) {
    if (!w.finishedAt) continue;
    const k = dayKey(w.startedAt);
    m.set(k, [...(m.get(k) ?? []), w]);
  }
  return m;
}

/**
 * Week streaks over all history: weeks in a row with at least one workout.
 * The current streak still counts if this week has nothing yet but last week did.
 */
export function weekStreaks(workouts: Workout[], now = Date.now()): { current: number; best: number } {
  const weeks = new Set<number>();
  for (const w of workouts) if (w.finishedAt) weeks.add(weekStart(w.startedAt));
  if (!weeks.size) return { current: 0, best: 0 };
  const prevWeek = (t: number) => {
    const d = new Date(t);
    d.setDate(d.getDate() - 7);
    return d.getTime();
  };
  let best = 0;
  for (const start of weeks) {
    if (weeks.has(prevWeek(start))) continue; // not the first week of a run
    let n = 0;
    for (let t = start; weeks.has(t); ) {
      n++;
      const d = new Date(t);
      d.setDate(d.getDate() + 7);
      t = d.getTime();
    }
    best = Math.max(best, n);
  }
  let t = weekStart(now);
  if (!weeks.has(t)) t = prevWeek(t);
  let current = 0;
  for (; weeks.has(t); t = prevWeek(t)) current++;
  return { current, best };
}
