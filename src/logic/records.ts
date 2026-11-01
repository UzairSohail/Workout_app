import type { Exercise, Workout } from '../types';
import { countedSets, recordsFor, sessionPrs, type PrKind, type Records } from './stats';

export interface ExerciseBests {
  exerciseId: string;
  records: Records;
  /** Timed exercise: reps hold seconds. */
  timed: boolean;
  sessions: number;
  /** When any of the records was last raised. */
  lastPrAt: number;
}

/** Best numbers for every exercise with at least one counted set, most recent record first. */
export function allBests(workouts: Workout[]): ExerciseBests[] {
  const ids = new Map<string, { timed: boolean; sessions: number }>();
  for (const w of workouts) {
    if (!w.finishedAt) continue;
    for (const e of w.exercises) {
      if (!countedSets(e.sets).length) continue;
      const cur = ids.get(e.exerciseId) ?? { timed: false, sessions: 0 };
      cur.sessions++;
      if (e.mode === 'time') cur.timed = true;
      ids.set(e.exerciseId, cur);
    }
  }
  const finished = workouts.filter((w) => w.finishedAt);
  const out: ExerciseBests[] = [];
  for (const [exerciseId, { timed, sessions }] of ids) {
    const records = recordsFor(exerciseId, finished);
    const lastPrAt = Math.max(
      records.maxWeightDate ?? 0, records.bestE1rmDate ?? 0, records.maxRepsDate ?? 0, records.maxVolumeDate ?? 0,
    );
    out.push({ exerciseId, records, timed, sessions, lastPrAt });
  }
  return out.sort((a, b) => b.lastPrAt - a.lastPrAt);
}

export interface WorkoutPr {
  exerciseId: string;
  kinds: PrKind[];
  weight: number;
  reps: number;
  timed: boolean;
}

/**
 * The best PR set of each exercise in a workout, judged against workouts before it.
 * One entry per exercise (its last PR set, which is the highest of the session).
 */
export function workoutPrs(w: Workout, finished: Workout[]): WorkoutPr[] {
  const before = finished.filter((x) => x.id !== w.id && x.startedAt < w.startedAt);
  const out: WorkoutPr[] = [];
  for (const e of w.exercises) {
    const hasHistory = before.some((x) => x.exercises.some((y) => y.exerciseId === e.exerciseId && countedSets(y.sets).length));
    const timed = e.mode === 'time';
    const prs = sessionPrs(e.sets, recordsFor(e.exerciseId, before), hasHistory)
      .map((kinds) => (timed ? kinds.filter((k) => k === 'reps') : kinds));
    let last = -1;
    prs.forEach((k, i) => { if (k.length) last = i; });
    if (last < 0) continue;
    const s = e.sets[last];
    const kinds = [...new Set(prs.flat())];
    const existing = out.find((p) => p.exerciseId === e.exerciseId);
    const entry = { exerciseId: e.exerciseId, kinds, weight: s.weight ?? 0, reps: s.reps ?? 0, timed };
    if (existing) Object.assign(existing, entry);
    else out.push(entry);
  }
  return out;
}

export const exerciseSort = (byId: Map<string, Exercise>) => (a: ExerciseBests, b: ExerciseBests) =>
  (byId.get(a.exerciseId)?.name ?? '').localeCompare(byId.get(b.exerciseId)?.name ?? '');
