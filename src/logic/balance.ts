import type { Exercise, Workout } from '../types';
import { countedSets } from './stats';

/** Main muscle groups and the library muscles that feed them. */
export const MUSCLE_GROUPS: { name: string; muscles: string[]; side: 'push' | 'pull' | 'legs' | 'core' }[] = [
  { name: 'Chest', muscles: ['chest'], side: 'push' },
  { name: 'Shoulders', muscles: ['shoulders'], side: 'push' },
  { name: 'Triceps', muscles: ['triceps'], side: 'push' },
  { name: 'Back', muscles: ['lats', 'middle back', 'traps'], side: 'pull' },
  { name: 'Biceps', muscles: ['biceps'], side: 'pull' },
  { name: 'Quads', muscles: ['quadriceps'], side: 'legs' },
  { name: 'Hamstrings', muscles: ['hamstrings'], side: 'legs' },
  { name: 'Glutes', muscles: ['glutes'], side: 'legs' },
  { name: 'Calves', muscles: ['calves'], side: 'legs' },
  { name: 'Abs', muscles: ['abdominals'], side: 'core' },
  { name: 'Lower back', muscles: ['lower back'], side: 'core' },
];

/** Weekly working sets: under LOW is light, LOW–HIGH is the usual growth range, over HIGH is a lot. */
export const LOW = 10;
export const HIGH = 20;

export type BalanceStatus = 'skipped' | 'low' | 'good' | 'high';

export interface GroupBalance { name: string; sets: number; status: BalanceStatus; side: string }

export interface Balance {
  groups: GroupBalance[];
  skipped: string[];
  push: number;
  pull: number;
  /** A tip when push and pull are far apart, else null. */
  tip: string | null;
}

const status = (sets: number): BalanceStatus => (sets === 0 ? 'skipped' : sets < LOW ? 'low' : sets <= HIGH ? 'good' : 'high');

/**
 * Working sets per muscle group since `since`. A set counts fully for the exercise's main muscles
 * and half for the muscles it also works; a group counts each set once even if several of its
 * muscles are hit.
 */
export function muscleBalance(workouts: Workout[], byId: Map<string, Exercise>, since: number): Balance {
  const sets = new Map<string, number>(MUSCLE_GROUPS.map((g) => [g.name, 0]));
  for (const w of workouts) {
    if (!w.finishedAt || w.startedAt < since) continue;
    for (const e of w.exercises) {
      const n = countedSets(e.sets).length;
      const ex = byId.get(e.exerciseId);
      if (!n || !ex) continue;
      for (const g of MUSCLE_GROUPS) {
        const share = g.muscles.some((m) => ex.primaryMuscles.includes(m)) ? 1
          : g.muscles.some((m) => ex.secondaryMuscles.includes(m)) ? 0.5 : 0;
        if (share) sets.set(g.name, sets.get(g.name)! + n * share);
      }
    }
  }
  const groups = MUSCLE_GROUPS.map((g) => {
    const n = Math.round(sets.get(g.name)! * 2) / 2;
    return { name: g.name, sets: n, status: status(n), side: g.side };
  });
  const sum = (side: string) => groups.filter((g) => g.side === side).reduce((a, g) => a + g.sets, 0);
  const push = sum('push');
  const pull = sum('pull');
  let tip: string | null = null;
  if (push >= 6 && push > pull * 1.5) tip = 'You are pushing a lot more than pulling. Add some rows, pulldowns or curls to keep your shoulders healthy.';
  else if (pull >= 6 && pull > push * 1.5) tip = 'You are pulling a lot more than pushing. Add some presses or dips to even it out.';
  return { groups, skipped: groups.filter((g) => g.status === 'skipped').map((g) => g.name), push, pull, tip };
}
