import type { LoggedExercise, Settings, Units, Workout } from '../types';
import { weekStart } from './progress';
import { fromDisplay, roundTo, toDisplay } from './units';

/** Weeks of steady training (2+ workouts each) before a lighter week is suggested. */
export const DELOAD_AFTER_WEEKS = 6;
const SNOOZE_DAYS = 14;
const DAY = 864e5;

const prevWeek = (t: number) => { const d = new Date(t); d.setDate(d.getDate() - 7); return d.getTime(); };

/** Consecutive training weeks (2+ workouts) up to now, counting only workouts after `since`. */
export function trainingWeeks(finished: Workout[], since = 0, now = Date.now()): number {
  const counts = new Map<number, number>();
  for (const w of finished) {
    if (!w.finishedAt || w.startedAt <= since || w.startedAt > now) continue;
    const wk = weekStart(w.startedAt);
    counts.set(wk, (counts.get(wk) ?? 0) + 1);
  }
  let t = weekStart(now);
  // This week only counts once it has two workouts; until then start from last week.
  if ((counts.get(t) ?? 0) < 2) t = prevWeek(t);
  let n = 0;
  for (; (counts.get(t) ?? 0) >= 2; t = prevWeek(t)) n++;
  return n;
}

export const deloadActive = (s: Pick<Settings, 'deloadUntil'>, now = Date.now()) => (s.deloadUntil ?? 0) > now;

export function deloadDue(finished: Workout[], s: Pick<Settings, 'deloadUntil' | 'lastDeloadAt' | 'deloadSnoozedAt'>, now = Date.now()): boolean {
  if (deloadActive(s, now)) return false;
  if (s.deloadSnoozedAt && now - s.deloadSnoozedAt < SNOOZE_DAYS * DAY) return false;
  return trainingWeeks(finished, s.lastDeloadAt ?? 0, now) >= DELOAD_AFTER_WEEKS;
}

/** A deload version of an exercise: half the work sets (rounded up) at about 90% of the weight. */
export function deloadExercise(le: LoggedExercise, increment: number, units: Units): LoggedExercise {
  if (le.scheme) return le;
  const warm = le.sets.filter((s) => s.type === 'warmup');
  const work = le.sets.filter((s) => s.type !== 'warmup');
  const keep = work.slice(0, Math.max(1, Math.ceil(work.length / 2))).map((s) => ({
    ...s,
    weight: s.weight ? fromDisplay(roundTo(toDisplay(s.weight * 0.9, units), increment), units) : s.weight,
  }));
  return { ...le, deload: true, sets: [...warm, ...keep] };
}
