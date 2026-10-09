import Dexie, { type EntityTable } from 'dexie';
import type { Exercise, Program, ProgramState, Settings, Workout } from './types';
import { BUILT_IN_PROGRAMS } from './programs';

export const db = new Dexie('workout-app') as Dexie & {
  settings: EntityTable<Settings, 'id'>;
  programs: EntityTable<Program, 'id'>;
  workouts: EntityTable<Workout, 'id'>;
  customExercises: EntityTable<Exercise, 'id'>;
  programState: EntityTable<ProgramState, 'programId'>;
};

db.version(1).stores({
  settings: 'id',
  programs: 'id, createdAt',
  workouts: 'id, startedAt, finishedAt',
  customExercises: 'id, name',
});
db.version(2).stores({
  programState: 'programId',
});

export const DEFAULT_SETTINGS: Settings = {
  id: 'me',
  name: '',
  units: 'kg',
  upperIncrement: 2.5,
  lowerIncrement: 5,
  defaultRest: 120,
  nextDayIndex: 0,
};

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Seeds settings and (re)writes the read-only built-in programs. Safe to call on every start. */
export async function initDb() {
  await db.transaction('rw', db.settings, db.programs, async () => {
    if (!(await db.settings.get('me'))) await db.settings.put(DEFAULT_SETTINGS);
    await db.programs.bulkPut(BUILT_IN_PROGRAMS);
  });
  // Ask the browser not to evict our data (important on iOS).
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* not supported */
  }
}

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('me')) ?? DEFAULT_SETTINGS;
}

export async function updateSettings(patch: Partial<Settings>) {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, id: 'me' });
}

export async function finishedWorkouts(): Promise<Workout[]> {
  const all = await db.workouts.orderBy('startedAt').reverse().toArray();
  return all.filter((w) => w.finishedAt);
}

export async function activeWorkout(): Promise<Workout | undefined> {
  const all = await db.workouts.toArray();
  return all.find((w) => !w.finishedAt);
}

export interface Backup {
  app: 'workout-app';
  version: 1;
  exportedAt: number;
  settings: Settings[];
  programs: Program[];
  workouts: Workout[];
  customExercises: Exercise[];
  programState?: ProgramState[];
}

export async function exportBackup(): Promise<Backup> {
  return {
    app: 'workout-app',
    version: 1,
    exportedAt: Date.now(),
    settings: await db.settings.toArray(),
    programs: (await db.programs.toArray()).filter((p) => !p.builtIn),
    workouts: await db.workouts.toArray(),
    customExercises: await db.customExercises.toArray(),
    programState: await db.programState.toArray(),
  };
}

/** Merges a backup into the database; existing rows with the same id are replaced. */
export async function importBackup(data: Backup) {
  if (data?.app !== 'workout-app') throw new Error('This file is not a workout app backup.');
  await db.transaction('rw', [db.settings, db.programs, db.workouts, db.customExercises, db.programState], async () => {
    await db.settings.bulkPut(data.settings ?? []);
    await db.programs.bulkPut(data.programs ?? []);
    await db.workouts.bulkPut(data.workouts ?? []);
    await db.customExercises.bulkPut(data.customExercises ?? []);
    await db.programState.bulkPut(data.programState ?? []);
  });
}

export async function getProgramState(programId: string): Promise<ProgramState> {
  return (await db.programState.get(programId)) ?? { programId, week: 0, doneDays: [], lifts: {} };
}
