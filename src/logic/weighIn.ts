import type { BodyWeight, Settings } from '../types';

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The reminder day, 0 = Sunday … 6 = Saturday; Sunday unless changed. -1 turns it off. */
export const weighInDay = (s: Pick<Settings, 'weighInDay'>) => s.weighInDay ?? 0;

/** Midnight at the start of the most recent reminder day (today if today is that day). */
export function lastWeighInDay(day: number, now = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() - day + 7) % 7));
  return d.getTime();
}

/**
 * True from the reminder day until weight is logged (any day counts) or the week is skipped.
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
