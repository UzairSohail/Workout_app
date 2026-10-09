import { describe, expect, it } from 'vitest';
import { lastWeighInDay, weighInDue } from './weighIn';

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
    expect(weighInDue([], {}, sun)).toBe(true);
    expect(weighInDue([], {}, tue)).toBe(true);
    expect(weighInDue([{ date: noon(sun) }], {}, tue)).toBe(false);
    // Logged on Monday (after the reminder day) still counts for the week.
    expect(weighInDue([{ date: noon(tue) - 864e5 }], {}, sat)).toBe(false);
    // A weigh-in from before the reminder day doesn't.
    expect(weighInDue([{ date: noon(sun) - 864e5 }], {}, sun)).toBe(true);
  });
  it('can be skipped for the week or turned off', () => {
    expect(weighInDue([], { weighInSkippedAt: sun }, sat)).toBe(false);
    expect(weighInDue([], { weighInSkippedAt: sun }, sat + 864e5)).toBe(true);
    expect(weighInDue([], { weighInDay: -1 }, sun)).toBe(false);
  });
});
