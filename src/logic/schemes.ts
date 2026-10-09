import type { LiftState, LoggedExercise, PlannedExercise, ProgramState, SchemeKind, Units } from '../types';
import { fmt, fromDisplay, roundTo, toDisplay } from './units';

export const liftKey = (scheme: SchemeKind, exerciseId: string) => `${scheme}:${exerciseId}`;

export const SCHEME_LABEL: Record<SchemeKind, string> = {
  linear: 'Linear',
  '531': '5/3/1',
  'gzcl-t1': 'GZCLP T1',
  'gzcl-t2': 'GZCLP T2',
  'gzcl-t3': 'GZCLP T3',
};

export const WEEKS_531 = [
  { name: '5s week', pct: [0.65, 0.75, 0.85], reps: [5, 5, 5], amrap: true },
  { name: '3s week', pct: [0.7, 0.8, 0.9], reps: [3, 3, 3], amrap: true },
  { name: '5/3/1 week', pct: [0.75, 0.85, 0.95], reps: [5, 3, 1], amrap: true },
  { name: 'Deload week', pct: [0.4, 0.5, 0.6], reps: [5, 5, 5], amrap: false },
];

/** [sets, reps] per stage. Moving to the next stage happens on a failed session. */
export const GZCL_STAGES: Record<'gzcl-t1' | 'gzcl-t2' | 'gzcl-t3', [number, number][]> = {
  'gzcl-t1': [[5, 3], [6, 2], [10, 1]],
  'gzcl-t2': [[3, 10], [3, 8], [3, 6]],
  'gzcl-t3': [[3, 15]],
};
const T3_TARGET = 25;
const LINEAR_MAX_FAILS = 3;

/** Smallest jump you can make on a barbell: 2.5 kg or 5 lb. */
export const plateStep = (units: Units) => (units === 'kg' ? 2.5 : 5);

export const emptyLift = (): LiftState => ({ weight: null, stage: 0, fails: 0 });

export const programUsesSchemes = (days: { exercises: PlannedExercise[] }[]) =>
  days.some((d) => d.exercises.some((e) => e.scheme));

export const uses531 = (days: { exercises: PlannedExercise[] }[]) =>
  days.some((d) => d.exercises.some((e) => e.scheme === '531'));

export interface Prescription {
  sets: { weight: number | null; target: number; amrap: boolean }[];
  note: string;
}

const addDisplay = (kg: number, inc: number, units: Units) => fromDisplay(toDisplay(kg, units) + inc, units);
const scaleRounded = (kg: number, factor: number, units: Units) =>
  fromDisplay(roundTo(toDisplay(kg, units) * factor, plateStep(units)), units);

/** Sets, weights and a one-line explanation for a scheme exercise. */
export function prescribe(
  p: PlannedExercise & { scheme: SchemeKind },
  lift: LiftState | undefined,
  week: number,
  increment: number,
  units: Units,
): Prescription {
  const l = lift ?? emptyLift();
  const inc = `${fmt(increment)} ${units}`;
  switch (p.scheme) {
    case 'linear': {
      const sets = Array.from({ length: p.sets }, () => ({ weight: l.weight, target: p.repMin, amrap: false }));
      const tail = l.fails > 0 ? ` Missed ${l.fails} time${l.fails === 1 ? '' : 's'}; ${LINEAR_MAX_FAILS} in a row drops the weight 10%.` : '';
      return { sets, note: `${p.sets}×${p.repMin}. Get every rep to add ${inc} next time.${tail}` };
    }
    case '531': {
      const wk = WEEKS_531[week % 4];
      if (l.weight == null) {
        return {
          sets: wk.reps.map((r, i) => ({ weight: null, target: r, amrap: wk.amrap && i === 2 })),
          note: `${wk.name}. Set a training max for this lift (Splits → this program) to get your weights.`,
        };
      }
      const sets = wk.pct.map((pct, i) => ({
        weight: scaleRounded(l.weight!, pct, units),
        target: wk.reps[i],
        amrap: wk.amrap && i === 2,
      }));
      const tm = `${fmt(toDisplay(l.weight, units))} ${units}`;
      return {
        sets,
        note: wk.amrap
          ? `${wk.name}: ${wk.pct.map((x) => Math.round(x * 100)).join('/')}% of your ${tm} training max. Last set: as many reps as you can.`
          : `${wk.name}: light sets to recover. Training max ${tm}.`,
      };
    }
    default: {
      const stages = GZCL_STAGES[p.scheme];
      const [n, reps] = stages[Math.min(l.stage, stages.length - 1)];
      const amrapLast = p.scheme !== 'gzcl-t2';
      const sets = Array.from({ length: n }, (_, i) => ({ weight: l.weight, target: reps, amrap: amrapLast && i === n - 1 }));
      const scheme = `${n}×${reps}${amrapLast ? '+' : ''}`;
      const note = p.scheme === 'gzcl-t3'
        ? `T3 ${scheme}. Hit ${T3_TARGET}+ reps on the last set to add weight.`
        : `${p.scheme === 'gzcl-t1' ? 'T1' : 'T2'} ${scheme}. Get every rep to add ${inc}; miss and you move to ${
          l.stage + 1 < stages.length ? `${stages[l.stage + 1][0]}×${stages[l.stage + 1][1]}` : 'a reset at 85%'
        }.`;
      return { sets, note };
    }
  }
}

/** Working sets that carried a prescription and were logged. */
function prescribedSets(le: LoggedExercise) {
  return le.sets.filter((s) => s.target != null && s.type !== 'warmup');
}

/** Next state for one lift after a finished session. 5/3/1 lifts only change at the end of a cycle. */
export function advance(
  scheme: SchemeKind,
  lift: LiftState | undefined,
  le: LoggedExercise,
  expectedSets: number,
  increment: number,
  units: Units,
): LiftState {
  const l = { ...(lift ?? emptyLift()) };
  if (scheme === '531') return l;
  const sets = prescribedSets(le).filter((s) => s.done && s.reps != null);
  if (sets.length === 0) return l;
  const used = Math.max(...sets.map((s) => s.weight ?? 0));
  const base = used > 0 ? used : l.weight;
  if (base == null) return l;
  const success = sets.length >= expectedSets && sets.every((s) => s.reps! >= s.target!);

  if (scheme === 'gzcl-t3') {
    const last = sets[sets.length - 1];
    return { ...l, weight: last.reps! >= T3_TARGET ? addDisplay(base, increment, units) : base };
  }
  if (success) return { weight: addDisplay(base, increment, units), stage: l.stage, fails: 0 };

  if (scheme === 'linear') {
    const fails = l.fails + 1;
    if (fails >= LINEAR_MAX_FAILS) return { weight: scaleRounded(base, 0.9, units), stage: 0, fails: 0 };
    return { weight: base, stage: 0, fails };
  }
  const stages = GZCL_STAGES[scheme];
  if (l.stage + 1 < stages.length) return { weight: base, stage: l.stage + 1, fails: 0 };
  return { weight: scaleRounded(base, 0.85, units), stage: 0, fails: 0 };
}

/**
 * Records a finished day. Once every day of the week is done, 5/3/1 moves to the next week,
 * and after the deload week each 5/3/1 training max goes up by one increment.
 */
export function completeDay(
  state: ProgramState,
  dayId: string,
  allDayIds: string[],
  incrementFor531: (exerciseId: string) => number,
  units: Units,
): ProgramState {
  const doneDays = state.doneDays.includes(dayId) ? state.doneDays : [...state.doneDays, dayId];
  if (!allDayIds.every((d) => doneDays.includes(d))) return { ...state, doneDays };
  const week = (state.week + 1) % 4;
  const lifts = { ...state.lifts };
  if (week === 0) {
    for (const [key, l] of Object.entries(lifts)) {
      if (!key.startsWith('531:') || l.weight == null) continue;
      lifts[key] = { ...l, weight: addDisplay(l.weight, incrementFor531(key.slice(4)), units) };
    }
  }
  return { ...state, week, doneDays: [], lifts };
}
