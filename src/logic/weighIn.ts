import type { BodyWeight, Settings } from '../types';
import { weekStart } from './progress';

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** weighInDay value for a daily reminder. */
export const EVERY_DAY = 7;

/** The reminder day: 7 = every day (the default), 0 = Sunday … 6 = Saturday, -1 = off. */
export const weighInDay = (s: Pick<Settings, 'weighInDay'>) => s.weighInDay ?? EVERY_DAY;

const midnight = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

/** Midnight at the start of the most recent reminder day (today if today is that day, or if it's daily). */
export function lastWeighInDay(day: number, now = Date.now()): number {
  const d = new Date(midnight(now));
  if (day !== EVERY_DAY) d.setDate(d.getDate() - ((d.getDay() - day + 7) % 7));
  return d.getTime();
}

/**
 * True from the reminder day until weight is logged (any day counts) or it's skipped.
 * With a daily reminder, that means until today's weight is in.
 * Entries are stored at noon of their day, so one logged on the reminder day itself counts.
 */
export function weighInDue(
  entries: Pick<BodyWeight, 'date'>[],
  s: Pick<Settings, 'weighInDay' | 'weighInSkippedAt'>,
  now = Date.now(),
): boolean {
  const day = weighInDay(s);
  if (day < 0) return false;
  const since = lastWeighInDay(day, now);
  if ((s.weighInSkippedAt ?? 0) >= since) return false;
  return !entries.some((e) => e.date >= since);
}

/** Today's entry, if any. */
export function todaysEntry<T extends Pick<BodyWeight, 'date'>>(entries: T[], now = Date.now()): T | undefined {
  const start = midnight(now);
  return entries.find((e) => e.date >= start && e.date < start + 864e5);
}

export interface WeekAverage { start: number; avg: number | null; count: number }

/** Average weight (kg) for each of the last `weeks` Monday–Sunday weeks, oldest first, including empty ones. */
export function weeklyAverages(entries: Pick<BodyWeight, 'date' | 'weight'>[], weeks = 12, now = Date.now()): WeekAverage[] {
  const current = weekStart(now);
  const out: { start: number; sum: number; count: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(current);
    d.setDate(d.getDate() - 7 * i); // whole days, so DST doesn't shift the boundary
    out.push({ start: d.getTime(), sum: 0, count: 0 });
  }
  for (const e of entries) {
    const b = out.find((w) => w.start === weekStart(e.date));
    if (!b) continue;
    b.sum += e.weight;
    b.count++;
  }
  return out.map((w) => ({ start: w.start, count: w.count, avg: w.count ? w.sum / w.count : null }));
}
