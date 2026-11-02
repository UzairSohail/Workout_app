import { describe, expect, it } from 'vitest';
import { EVERY_DAY, lastWeighInDay, todaysEntry, weeklyAverages, weighInDue } from './weighIn';

// Sunday 11 Oct 2026, 9am local; Tuesday 13 Oct; Saturday 17 Oct.
const sun = new Date(2026, 9, 11, 9).getTime();
const tue = new Date(2026, 9, 13, 9).getTime();
const sat = new Date(2026, 9, 17, 9).getTime();
const noon = (t: number) => { const d = new Date(t); d.setHours(12, 0, 0, 0); return d.getTime(); };

describe('weekly weigh-in', () => {
  it('finds the most recent reminder day, including today', () => {
    expect(new Date(lastWeighInDay(0, sun)).getDate()).toBe(11);
    expect(new Date(lastWeighInDay(0, sat)).getDate()).toBe(11);
    expect(new Date(lastWeighInDay(2, sun)).getDate()).toBe(6);
  });
  it('is due from the reminder day until weight is logged', () => {
    const weekly = { weighInDay: 0 };
    expect(weighInDue([], weekly, sun)).toBe(true);
    expect(weighInDue([], weekly, tue)).toBe(true);
    expect(weighInDue([{ date: noon(sun) }], weekly, tue)).toBe(false);
    // Logged on Monday (after the reminder day) still counts for the week.
    expect(weighInDue([{ date: noon(tue) - 864e5 }], weekly, sat)).toBe(false);
    // A weigh-in from before the reminder day doesn't.
    expect(weighInDue([{ date: noon(sun) - 864e5 }], weekly, sun)).toBe(true);
  });
  it('can be skipped for the week or turned off', () => {
    expect(weighInDue([], { weighInDay: 0, weighInSkippedAt: sun }, sat)).toBe(false);
    expect(weighInDue([], { weighInDay: 0, weighInSkippedAt: sun }, sat + 864e5)).toBe(true);
    expect(weighInDue([], { weighInDay: -1 }, sun)).toBe(false);
  });
  it('asks every day by default until today is logged', () => {
    expect(weighInDue([], {}, tue)).toBe(true);
    expect(weighInDue([{ date: noon(tue) - 864e5 }], {}, tue)).toBe(true);
    expect(weighInDue([{ date: noon(tue) }], {}, tue)).toBe(false);
    expect(weighInDue([], { weighInDay: EVERY_DAY, weighInSkippedAt: tue }, tue + 3600e3)).toBe(false);
    expect(weighInDue([], { weighInDay: EVERY_DAY, weighInSkippedAt: tue }, tue + 864e5)).toBe(true);
  });
  it('finds today\'s entry', () => {
    expect(todaysEntry([{ date: noon(sun) }, { date: noon(tue) }], tue)?.date).toBe(noon(tue));
    expect(todaysEntry([{ date: noon(sun) }], tue)).toBeUndefined();
  });
});

describe('weekly averages', () => {
  it('averages each Monday–Sunday week, keeping empty weeks', () => {
    // Mon 5 – Sun 11 Oct: 80, 81, 79 → 80. Mon 12 – Sat 17: 78, 79 → 78.5.
    const at = (day: number, weight: number) => ({ date: new Date(2026, 9, day, 12).getTime(), weight });
    const weeks = weeklyAverages([at(5, 80), at(8, 81), at(11, 79), at(13, 78), at(17, 79), at(1, 90)], 3, sat);
    expect(weeks.map((w) => w.avg)).toEqual([90, 80, 78.5]);
    expect(weeks.map((w) => w.count)).toEqual([1, 3, 2]);
    expect(new Date(weeks[2].start).getDate()).toBe(12);
    expect(weeklyAverages([], 2, sat).map((w) => w.avg)).toEqual([null, null]);
  });
});
