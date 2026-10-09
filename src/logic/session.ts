import { db, getProgramState, getSettings, uid } from '../db';
import type { Day, Exercise, LoggedExercise, LoggedSet, PlannedExercise, Program, ProgramState, SchemeKind, Settings, Workout } from '../types';
import { suggest } from './progression';
import { advance, completeDay, emptyLift, GZCL_STAGES, liftKey, prescribe } from './schemes';
import { countedSets, LOWER_BODY } from './stats';
import { wantsWarmup, warmupSets } from './warmup';

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

/** Last top working weight logged for an exercise, used when a program lift has no starting weight yet. */
export function lastTopWeight(exerciseId: string, finished: Workout[]): number | null {
  const last = historyFor(exerciseId, finished)[0];
  if (!last) return null;
  const top = Math.max(0, ...countedSets(last.sets).map((s) => s.weight));
  return top > 0 ? top : null;
}

function schemeExercise(
  p: PlannedExercise & { scheme: SchemeKind },
  state: ProgramState,
  finished: Workout[],
  byId: Map<string, Exercise>,
  settings: Settings,
): LoggedExercise {
  const lift = state.lifts[liftKey(p.scheme, p.exerciseId)];
  const fallback = p.scheme === '531' ? null : lastTopWeight(p.exerciseId, finished);
  const rx = prescribe(
    p,
    lift?.weight == null && fallback != null ? { ...(lift ?? emptyLift()), weight: fallback } : lift,
    state.week,
    incrementFor(byId.get(p.exerciseId), settings),
    settings.units,
  );
  return {
    exerciseId: p.exerciseId,
    repMin: Math.min(...rx.sets.map((x) => x.target)),
    repMax: Math.max(...rx.sets.map((x) => x.target)),
    rest: p.rest,
    scheme: p.scheme,
    note: rx.note,
    sets: rx.sets.map((x) => ({ weight: x.weight, reps: null, type: 'working', done: false, target: x.target, amrap: x.amrap })),
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
    const state = opts.program ? await getProgramState(opts.program.id) : undefined;
    exercises = opts.day.exercises.map((p) =>
      p.scheme && state
        ? schemeExercise(p as PlannedExercise & { scheme: SchemeKind }, state, finished, byId, settings)
        : newLoggedExercise(p.exerciseId, p.sets, p.repMin, p.repMax, p.rest, finished, byId, settings),
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
  if (settings.warmups !== false) exercises = exercises.map((e, i) => withWarmups(e, byId.get(e.exerciseId), i === 0, settings));
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
  if (w.programId && w.dayId) await advanceProgram(w.programId, w.dayId, exercises, settings);
  if (w.programId && w.programId === settings.activeProgramId && w.dayId) {
    const program = await db.programs.get(w.programId);
    const idx = program?.days.findIndex((d) => d.id === w.dayId) ?? -1;
    if (program && idx >= 0) {
      await db.settings.put({ ...settings, nextDayIndex: (idx + 1) % program.days.length });
    }
  }
}

async function advanceProgram(programId: string, dayId: string, logged: LoggedExercise[], settings: Settings) {
  const program = await db.programs.get(programId);
  const day = program?.days.find((d) => d.id === dayId);
  if (!program || !day || !day.exercises.some((e) => e.scheme)) return;
  const { loadLibrary } = await import('../exercises');
  const library = await loadLibrary().catch(() => []);
  const custom = await db.customExercises.toArray();
  const byId = new Map([...library, ...custom].map((e) => [e.id, e]));
  const inc = (exerciseId: string) => incrementFor(byId.get(exerciseId), settings);

  let state = await getProgramState(programId);
  const lifts = { ...state.lifts };
  for (const p of day.exercises) {
    if (!p.scheme) continue;
    const le = logged.find((e) => e.exerciseId === p.exerciseId && e.scheme === p.scheme);
    if (!le) continue;
    const key = liftKey(p.scheme, p.exerciseId);
    const stages = p.scheme in GZCL_STAGES ? GZCL_STAGES[p.scheme as keyof typeof GZCL_STAGES] : null;
    const expected = stages ? stages[Math.min(lifts[key]?.stage ?? 0, stages.length - 1)][0] : p.sets;
    lifts[key] = advance(p.scheme, lifts[key], le, expected, inc(p.exerciseId), settings.units);
  }
  state = { ...state, lifts };
  if (day.exercises.some((e) => e.scheme === '531')) {
    state = completeDay(state, dayId, program.days.map((d) => d.id), inc, settings.units);
  }
  await db.programState.put(state);
}

/** Prepends warm-up sets based on the first working set's weight (no-op if one is already there). */
export function withWarmups(le: LoggedExercise, ex: Exercise | undefined, isFirst: boolean, settings: Settings): LoggedExercise {
  if (!wantsWarmup(ex, isFirst) || le.sets.some((s) => s.type === 'warmup')) return le;
  const work = le.sets.find((s) => s.type !== 'warmup')?.weight ?? null;
  const warm = warmupSets(work, ex!.equipment, settings.units);
  return warm.length ? { ...le, sets: [...warm, ...le.sets] } : le;
}
