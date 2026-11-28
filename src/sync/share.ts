import { db, updateSettings } from '../db';
import type { Exercise, LoggedExercise, Program, Workout } from '../types';

/**
 * A split shared between two accounts (partners). The plan (days, exercises, sets, reps, rests) lives in
 * one cloud document both accounts can edit, and each phone keeps its own copy of it. Workouts, weights,
 * progress and the "next day" pointer stay with each person, because those live in other tables.
 */

export interface SharedPlan {
  owner: string;
  members: string[];
  /** JSON of the program (id, name, description, days). */
  program: string;
  /** JSON of the custom exercises the plan uses, so the partner's phone knows them. */
  exercises: string;
  /** Changes whenever the plan is saved (the server time). */
  version: string;
  /** 'workout' for a single workout (shared as a saved workout); a split otherwise. */
  kind?: 'split' | 'workout';
}

type Payload = { program: string; exercises: string; kind?: 'split' | 'workout' };

export interface ShareRemote {
  get(code: string): Promise<SharedPlan | null>;
  create(code: string, plan: Payload): Promise<void>;
  /** Adds the signed-in account to the plan's members. */
  join(code: string): Promise<void>;
  update(code: string, plan: Payload): Promise<void>;
  remove(code: string): Promise<void>;
}

/** Most people a plan can be shared between (the owner included). */
export const MAX_MEMBERS = 4;

/** What this phone last saw of each shared plan, to tell its own edits from the partner's. */
type ShareState = Record<string, { seen: string; hash: string }>;
const STATE_KEY = 'share-state';

function readState(): ShareState {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) || '{}') as ShareState;
  } catch {
    return {};
  }
}
function writeState(s: ShareState) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked */
  }
}
function remember(code: string, seen: string, p: Program | string) {
  writeState({ ...readState(), [code]: { seen, hash: typeof p === 'string' ? p : planHash(p) } });
}
function forget(code: string) {
  const s = readState();
  delete s[code];
  writeState(s);
}

/** No 0/O or 1/I/L, so a code read out loud or typed from a message is hard to get wrong. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}
/** Turns what the person typed ("abcd-efgh", with spaces) into the stored code. */
export const cleanCode = (typed: string) => typed.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const showCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

const planHash = (p: Program) => JSON.stringify([p.name, p.description ?? '', p.days]);

async function customFor(ids: Set<string>) {
  return JSON.stringify((await db.customExercises.toArray()).filter((e) => ids.has(e.id)));
}

async function payload(p: Program): Promise<Payload> {
  const ids = new Set(p.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)));
  return {
    program: JSON.stringify({ id: p.id, name: p.name, description: p.description, days: p.days }),
    exercises: await customFor(ids),
  };
}

// ---- Single workouts ----------------------------------------------------------

/** The plan of a workout without anyone's weights or reps: exercises, set counts, rep ranges, rests, supersets. */
function template(w: Workout): { name: string; exercises: LoggedExercise[] } {
  return {
    name: w.name.trim() || 'Workout',
    exercises: w.exercises.map((e) => ({
      exerciseId: e.exerciseId, repMin: e.repMin, repMax: e.repMax, rest: e.rest,
      ...(e.mode ? { mode: e.mode } : {}),
      ...(e.supersetWithNext ? { supersetWithNext: true } : {}),
      sets: e.sets.filter((s) => s.type !== 'warmup').map((s) => ({ weight: null, reps: null, type: s.type, done: false })),
    })),
  };
}
const workoutHash = (w: Workout) => JSON.stringify(template(w));

async function workoutPayload(w: Workout): Promise<Payload> {
  return {
    kind: 'workout',
    program: JSON.stringify(template(w)),
    exercises: await customFor(new Set(w.exercises.map((e) => e.exerciseId))),
  };
}

/**
 * Workouts this phone shared, by workout id. Kept beside the workout rather than on it, because the workout
 * screen saves its whole row on every tap and would drop a field it doesn't know about.
 */
const WORKOUTS_KEY = 'share-workouts';
function sharedWorkouts(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(WORKOUTS_KEY) || '{}') as Record<string, string>;
  } catch {
    return {};
  }
}
function setSharedWorkouts(m: Record<string, string>) {
  try {
    localStorage.setItem(WORKOUTS_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

/** Shares a workout's exercises (not its weights or reps). Sharing again sends the latest version under the same code. */
export async function shareWorkout(remote: ShareRemote, workoutId: string): Promise<string> {
  const w = await db.workouts.get(workoutId);
  if (!w) throw new Error('That workout is gone.');
  const plan = await workoutPayload(w);
  let code: string | undefined = sharedWorkouts()[w.id];
  if (code && (await remote.get(code))) {
    await remote.update(code, plan);
  } else {
    code = newCode();
    await remote.create(code, plan);
    setSharedWorkouts({ ...sharedWorkouts(), [w.id]: code });
  }
  const after = await remote.get(code);
  remember(code, after?.version ?? '', workoutHash(w));
  return code;
}

/** Puts a partner's workout into Saved workouts, replacing an older copy of the same one. */
async function applyWorkout(code: string, plan: SharedPlan): Promise<Workout> {
  const t = JSON.parse(plan.program) as { name: string; exercises: LoggedExercise[] };
  const exercises = JSON.parse(plan.exercises || '[]') as Exercise[];
  const existing = (await db.savedWorkouts.toArray()).find((x) => x.shareCode === code);
  const saved: Workout = { id: existing?.id ?? `shared-${code}`, name: t.name, startedAt: Date.now(), exercises: t.exercises, shareCode: code };
  await db.transaction('rw', db.savedWorkouts, db.customExercises, async () => {
    await db.savedWorkouts.put(saved);
    for (const e of exercises) if (!(await db.customExercises.get(e.id))) await db.customExercises.put(e);
  });
  remember(code, plan.version, '');
  return saved;
}

/** Writes the cloud's version of the plan into this phone's copy, with any custom exercises it uses. */
async function applyPlan(code: string, plan: SharedPlan, localId?: string): Promise<Program> {
  const src = JSON.parse(plan.program) as Pick<Program, 'id' | 'name' | 'description' | 'days'>;
  const exercises = JSON.parse(plan.exercises || '[]') as Exercise[];
  const id = localId ?? src.id;
  const existing = await db.programs.get(id);
  const program: Program = {
    id, name: src.name, description: src.description, days: src.days,
    createdAt: existing?.createdAt ?? Date.now(), shareCode: code,
  };
  await db.transaction('rw', db.programs, db.customExercises, async () => {
    await db.programs.put(program);
    for (const e of exercises) if (!(await db.customExercises.get(e.id))) await db.customExercises.put(e);
  });
  remember(code, plan.version, program);
  return program;
}

/** Keeps a copy of the split on this phone but stops following the shared one. */
async function unlink(p: Program) {
  const code = p.shareCode;
  await db.programs.put({ ...p, shareCode: undefined });
  if (code) forget(code);
}

/** Makes a code for the split so a partner can follow it. Returns the code. */
export async function shareProgram(remote: ShareRemote, programId: string): Promise<string> {
  const p = await db.programs.get(programId);
  if (!p || p.builtIn) throw new Error('Only your own splits can be shared. Make a copy first.');
  if (p.shareCode) return p.shareCode;
  const code = newCode();
  await remote.create(code, await payload(p));
  const plan = await remote.get(code);
  const shared = { ...p, shareCode: code };
  await db.programs.put(shared);
  remember(code, plan?.version ?? '', shared);
  return code;
}

export type Joined = { kind: 'split'; program: Program } | { kind: 'workout'; workout: Workout };

/** Follows a partner's split from its code (it becomes the active split), or adds their shared workout to Saved workouts. */
export async function joinShared(remote: ShareRemote, uid: string, typed: string): Promise<Joined> {
  const code = cleanCode(typed);
  if (code.length !== 8) throw new Error('The code has 8 letters and numbers, like ABCD-2345.');
  let plan = await remote.get(code);
  if (!plan) throw new Error('Nothing is shared with that code. Check it with your partner.');
  if (plan.kind === 'workout') return { kind: 'workout', workout: await applyWorkout(code, plan) };
  if (!plan.members.includes(uid)) {
    if (plan.members.length >= MAX_MEMBERS) throw new Error('That split is already shared with the most people it can be.');
    await remote.join(code);
    plan = (await remote.get(code)) ?? plan;
  }
  const mine = (await db.programs.toArray()).find((p) => p.shareCode === code);
  const program = await applyPlan(code, plan, mine?.id);
  await updateSettings({ activeProgramId: program.id, nextDayIndex: 0 });
  return { kind: 'split', program };
}

/** Follows a partner's split from its code and makes it this phone's active split. */
export async function joinProgram(remote: ShareRemote, uid: string, typed: string): Promise<Program> {
  const r = await joinShared(remote, uid, typed);
  if (r.kind !== 'split') throw new Error('That code is for a single workout, not a split.');
  return r.program;
}

/** Stops sharing. The owner deletes the shared plan (partners keep their copy); a partner just stops following it. */
export async function stopSharing(remote: ShareRemote, uid: string, programId: string) {
  const p = await db.programs.get(programId);
  if (!p?.shareCode) return;
  const plan = await remote.get(p.shareCode).catch(() => null);
  if (plan?.owner === uid) await remote.remove(p.shareCode);
  await unlink(p);
}

/**
 * Brings each shared split up to date: the partner's changes come down, this phone's changes go up.
 * If both changed it since the last sync, the cloud's copy wins.
 */
export async function syncShared(remote: ShareRemote, uid: string) {
  const shared = (await db.programs.toArray()).filter((p) => p.shareCode);
  for (const p of shared) {
    const code = p.shareCode!;
    const plan = await remote.get(code);
    if (!plan || !plan.members.includes(uid)) {
      // The owner stopped sharing: keep the split as this person's own.
      await unlink(p);
      continue;
    }
    const st = readState()[code];
    if (!st || st.seen !== plan.version) {
      await applyPlan(code, plan, p.id);
    } else if (st.hash !== planHash(p)) {
      await remote.update(code, await payload(p));
      const after = await remote.get(code);
      remember(code, after?.version ?? st.seen, p);
    }
  }

  // A workout this person shared and is still doing: send edits (added, removed or reordered exercises, set counts).
  const mine = sharedWorkouts();
  for (const [id, code] of Object.entries(mine)) {
    const w = await db.workouts.get(id);
    if (!w || w.finishedAt) {
      // Done or discarded: stop following it (the partner keeps their copy).
      delete mine[id];
      setSharedWorkouts(mine);
      continue;
    }
    const st = readState()[code];
    if (!st || st.hash === workoutHash(w)) continue;
    const plan = await remote.get(code);
    if (!plan || plan.owner !== uid) continue;
    await remote.update(code, await workoutPayload(w));
    const after = await remote.get(code);
    remember(code, after?.version ?? st.seen, workoutHash(w));
  }

  // A partner's workout waiting in Saved workouts: take their latest version.
  for (const t of (await db.savedWorkouts.toArray()).filter((x) => x.shareCode)) {
    const plan = await remote.get(t.shareCode!);
    if (!plan) {
      await db.savedWorkouts.put({ ...t, shareCode: undefined });
      forget(t.shareCode!);
    } else if (plan.version !== readState()[t.shareCode!]?.seen) {
      await applyWorkout(t.shareCode!, plan);
    }
  }
}

/** True when the split follows a shared plan. */
export const isShared = (p?: Program) => !!p?.shareCode;
