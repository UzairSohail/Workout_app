import type { BodyWeight, Units } from '../types';
import { fmt, toDisplay } from '../logic/units';
import { weeklyAverages } from '../logic/weighIn';

export const kgText = (kg: number, units: Units) => `${fmt(Math.round(toDisplay(kg, units) * 10) / 10)} ${units}`;

/** "▼ 0.4 kg" / "▲ 0.4 kg" / "no change", in display units. */
export function changeText(deltaKg: number, units: Units): string {
  const d = Math.round(toDisplay(deltaKg, units) * 10) / 10;
  if (d === 0) return 'no change';
  return `${d < 0 ? '▼' : '▲'} ${fmt(Math.abs(d))} ${units}`;
}

/** This week's and last week's average, and how last week compares with the week before. */
export function weekStats(entries: Pick<BodyWeight, 'date' | 'weight'>[], now = Date.now()) {
  const [before, last, current] = weeklyAverages(entries, 3, now);
  return {
    thisWeek: current,
    lastWeek: last,
    lastWeekChange: last.avg != null && before.avg != null ? last.avg - before.avg : null,
    thisWeekChange: current.avg != null && last.avg != null ? current.avg - last.avg : null,
  };
}
