import type { Exercise, Settings } from '../types';
import { LOWER_BODY } from './stats';
import { fromDisplay, toDisplay } from './units';

/**
 * Rough working weight for 8–12 reps as a fraction of body weight, for a beginner man.
 * Dumbbell numbers are per hand. null means bodyweight or unknown, so no suggestion.
 */
export function bodyweightRatio(ex: Exercise): number | null {
  const n = ex.name.toLowerCase();
  const eq = ex.equipment;
  const muscle = ex.primaryMuscles[0] ?? '';
  const lower = LOWER_BODY.has(muscle);
  const compound = ex.mechanic === 'compound';
  if (ex.category === 'cardio' || (!['strength', 'powerlifting', 'custom'].includes(ex.category) && !ex.custom)) return null;
  if (eq === 'body only' || !eq) return null;
  const db = eq === 'dumbbell' || eq === 'kettlebells';
  // A pin-loaded seated leg press has no heavy sled, so the stack number reads lower.
  if (/seated leg press/.test(n)) return 0.7;
  if (/leg press/.test(n)) return 1.0;
  if (/deadlift/.test(n)) return db ? 0.2 : 0.75;
  if (/calf/.test(n)) return db ? 0.15 : 0.5;
  if (/shrug/.test(n)) return db ? 0.25 : 0.6;
  if (/lateral raise|front raise|rear delt|reverse fl/.test(n)) return db ? 0.04 : 0.06;
  if (/\bfly|flye|crossover|butterfly/.test(n)) return db ? 0.06 : 0.15;
  switch (eq) {
    case 'barbell': return lower ? 0.6 : muscle === 'shoulders' ? 0.3 : compound ? 0.45 : 0.2;
    case 'e-z curl bar': return 0.2;
    case 'dumbbell': return lower ? 0.15 : muscle === 'shoulders' ? 0.1 : compound ? 0.15 : 0.07;
    case 'kettlebells': return lower ? 0.2 : 0.1;
    case 'cable': return compound ? 0.4 : 0.15;
    case 'machine': return lower ? (compound ? 0.8 : 0.3) : compound ? 0.4 : 0.2;
    default: return null;
  }
}

const SEX = { male: [1, 1], female: [0.55, 0.7], unset: [0.75, 0.85] } as const;
const LEVEL = { beginner: 1, intermediate: 1.35, advanced: 1.7 } as const;

function step(ex: Exercise, s: Settings): number {
  const kg = s.units === 'kg';
  if (ex.equipment === 'barbell' || ex.equipment === 'e-z curl bar') return kg ? 2.5 : 5;
  if (ex.equipment === 'machine' || ex.equipment === 'cable') return kg ? 5 : 10;
  return kg ? 2 : 5;
}

/**
 * Starting weight (kg) from the profile in Settings, rounded down to something loadable.
 * Body weight above a BMI of 27 is ignored when height is known, since strength tracks muscle, not total mass.
 */
export function startingWeight(ex: Exercise | undefined, s: Settings, repMin = 8, repMax = 12): number | null {
  if (!ex || !s.bodyWeight) return null;
  const ratio = bodyweightRatio(ex);
  if (ratio == null) return null;
  let bw = s.bodyWeight;
  if (s.height) bw = Math.min(bw, 27 * (s.height / 100) ** 2);
  const lower = LOWER_BODY.has(ex.primaryMuscles[0] ?? '');
  const sex = SEX[s.sex ?? 'unset'][lower ? 1 : 0];
  const reps = repMax <= 6 ? 1.15 : repMin >= 12 ? 0.85 : 1;
  const kg = bw * ratio * sex * LEVEL[s.experience ?? 'beginner'] * reps;
  const st = step(ex, s);
  const isBar = ex.equipment === 'barbell';
  const minDisplay = isBar ? (s.units === 'kg' ? 20 : 45) : st;
  const display = Math.max(minDisplay, Math.floor(toDisplay(kg, s.units) / st) * st);
  return fromDisplay(display, s.units);
}
