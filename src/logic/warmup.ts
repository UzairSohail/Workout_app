import type { Exercise, LoggedSet, Units } from '../types';
import { plateStep } from './schemes';
import { fromDisplay, roundTo, toDisplay } from './units';

const BAR: Record<Units, number> = { kg: 20, lb: 45 };

/** Whether an exercise gets warm-up sets: barbell compounds always, other loaded compounds only when first in the workout. */
export function wantsWarmup(ex: Exercise | undefined, isFirst: boolean): boolean {
  if (!ex || ex.mechanic !== 'compound') return false;
  if (ex.equipment === 'barbell') return true;
  return isFirst && ['dumbbell', 'machine', 'cable', 'kettlebells', 'e-z curl bar'].includes(ex.equipment);
}

/** Ramp-up sets for a working weight (kg). Empty when the weight is too light to need them. */
export function warmupSets(workKg: number | null, equipment: string, units: Units): LoggedSet[] {
  if (!workKg || workKg <= 0) return [];
  const work = toDisplay(workKg, units);
  const step = equipment === 'barbell' ? plateStep(units) : units === 'kg' ? 2 : 5;
  const ramp: [number, number][] = equipment === 'barbell' ? [[0.4, 5], [0.6, 3], [0.8, 2]] : [[0.5, 8], [0.75, 4]];
  const out: { w: number; reps: number }[] = [];
  if (equipment === 'barbell' && work > BAR[units] * 1.5) out.push({ w: BAR[units], reps: 10 });
  for (const [pct, reps] of ramp) {
    const w = roundTo(work * pct, step);
    const last = out[out.length - 1]?.w ?? 0;
    if (w > last && w < work && (equipment !== 'barbell' || w > BAR[units])) out.push({ w, reps });
  }
  return out.map(({ w, reps }) => ({ weight: fromDisplay(w, units), reps: null, target: reps, type: 'warmup', done: false }));
}
