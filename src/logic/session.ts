import { db, getSettings, uid } from '../db';
import type { Day, Exercise, LoggedExercise, LoggedSet, Program, Settings, Workout } from '../types';
import { suggest } from './progression';
import { LOWER_BODY } from './stats';

/** Previous sessions of one exercise, most recent first. */
export function historyFor(exerciseId: string, finished: Workout[], excludeId?: string): LoggedExercise[] {
  const out: LoggedExercise[] = [];
  const sorted = [...finished].sort((a, b) => b.startedAt - a.startedAt);
  for (const w of sorted) {
    if (w.id === excludeId || !w.finishedAt) continue;
    for (const e of w.exercises) if (e.exerciseId === exerciseId) out.push(e);
  }
  return out;
}

export function incrementFor(ex: Exercise | undefined, s: Settings): number {
  const lower = ex?.primaryMuscles.some((m) => LOWER_BODY.has(m));
  return lower ? s.lowerIncrement : s.upperIncrement;
}

export function suggestionFor(
  le: Pick<LoggedExercise, 'exerciseId' | 'repMin' | 'repMax'>,
  finished: Workout[],
  byId: Map<string, Exercise>,
  settings: Settings,
  excludeId?: string,
) {
  return suggest(
    historyFor(le.exerciseId, finished, excludeId),
    le.repMin,
    le.repMax,
    incrementFor(byId.get(le.exerciseId), settings),
    settings.units,
  );
}

const blankSet = (weight: number | null = null): LoggedSet => ({ weight, reps: null, type: 'working', done: false });

export function newLoggedExercise(
  exerciseId: string,
  sets: number,
  repMin: number,
  repMax: number,
  rest: number,
  finished: Workout[],
  byId: Map<string, Exercise>,
  settings: Settings,
): LoggedExercise {
  const s = suggestionFor({ exerciseId, repMin, repMax }, finished, byId, settings);
  return {
    exerciseId, repMin, repMax, rest,
    sets: Array.from({ length: Math.max(1, sets) }, () => blankSet(s.weight)),
  };
}

async function allFinished() {
  return (await db.workouts.toArray()).filter((w) => w.finishedAt);
}

export async function startWorkout(
  opts: { program?: Program; day?: Day; copyOf?: Workout },
  byId: Map<string, Exercise>,
): Promise<string> {
  const existing = (await db.workouts.toArray()).find((w) => !w.finishedAt);
  if (existing) return existing.id;
  const settings = await getSettings();
  const finished = await allFinished();
  let exercises: LoggedExercise[] = [];
  let name = 'Workout';
  if (opts.day) {
    name = opts.day.name;
    exercises = opts.day.exercises.map((p) =>
      newLoggedExercise(p.exerciseId, p.sets, p.repMin, p.repMax, p.rest, finished, byId, settings),
    );
  } else if (opts.copyOf) {
    name = opts.copyOf.name;
    exercises = opts.copyOf.exercises.map((e) =>
      newLoggedExercise(
        e.exerciseId,
        e.sets.filter((s) => s.type !== 'warmup').length || 1,
        e.repMin, e.repMax, e.rest, finished, byId, settings,
      ),
    );
  }
  const w: Workout = {
    id: uid(),
    name,
    programId: opts.program?.id ?? opts.copyOf?.programId,
    dayId: opts.day?.id ?? opts.copyOf?.dayId,
    startedAt: Date.now(),
    exercises,
  };
  await db.workouts.put(w);
  return w.id;
}

/** Marks the workout finished and advances the active program to its next day. */
export async function finishWorkout(w: Workout) {
  // Drop sets that were never touched.
  const exercises = w.exercises
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
    .filter((e) => e.sets.length > 0);
  await db.workouts.put({ ...w, exercises, finishedAt: Date.now() });
  const settings = await getSettings();
  if (w.programId && w.programId === settings.activeProgramId && w.dayId) {
    const program = await db.programs.get(w.programId);
    const idx = program?.days.findIndex((d) => d.id === w.dayId) ?? -1;
    if (program && idx >= 0) {
      await db.settings.put({ ...settings, nextDayIndex: (idx + 1) % program.days.length });
    }
  }
}
