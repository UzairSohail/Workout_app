import type { Exercise } from '../types';

/** Equipment the user can untick in Settings, as named in the exercise library. Bodyweight is always available. */
export const GEAR: [string, string][] = [
  ['barbell', 'Barbell and plates'],
  ['dumbbell', 'Dumbbells'],
  ['cable', 'Cable machine'],
  ['machine', 'Weight machines'],
  ['e-z curl bar', 'EZ curl bar'],
  ['kettlebells', 'Kettlebells'],
  ['bands', 'Resistance bands'],
  ['medicine ball', 'Medicine ball'],
  ['exercise ball', 'Exercise ball'],
  ['foam roll', 'Foam roller'],
];

/** Whether the user's gym has what this exercise needs. Custom exercises are always allowed. */
export function hasGear(ex: Pick<Exercise, 'equipment' | 'custom'> | undefined, missing: readonly string[] | undefined): boolean {
  if (!ex || ex.custom || !missing?.length) return true;
  return !missing.includes(ex.equipment);
}

/** The generator's equipment answer that best fits what's missing. */
export function generatorEquipment(missing: readonly string[] | undefined): 'gym' | 'dumbbells' | 'bodyweight' {
  const m = new Set(missing ?? []);
  const noGym = m.has('barbell') && m.has('cable') && m.has('machine');
  if (!noGym) return 'gym';
  return m.has('dumbbell') ? 'bodyweight' : 'dumbbells';
}
