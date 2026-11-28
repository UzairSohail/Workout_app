import { db, updateSettings } from '../db';
import type { Exercise, Program } from '../types';

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
}

export interface ShareRemote {
  get(code: string): Promise<SharedPlan | null>;
  create(code: string, plan: { program: string; exercises: string }): Promise<void>;
  /** Adds the signed-in account to the plan's members. */
  join(code: string): Promise<void>;
  update(code: string, plan: { program: string; exercises: string }): Promise<void>;
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
function remember(code: string, seen: string, p: Program) {
  writeState({ ...readState(), [code]: { seen, hash: planHash(p) } });
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

async function payload(p: Program) {
  const ids = new Set(p.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)));
  const custom = (await db.customExercises.toArray()).filter((e) => ids.has(e.id));
  return {
    program: JSON.stringify({ id: p.id, name: p.name, description: p.description, days: p.days }),
    exercises: JSON.stringify(custom),
  };
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

/** Follows a partner's split from its code and makes it this phone's active split. */
export async function joinProgram(remote: ShareRemote, uid: string, typed: string): Promise<Program> {
  const code = cleanCode(typed);
  if (code.length !== 8) throw new Error('The code has 8 letters and numbers, like ABCD-2345.');
  let plan = await remote.get(code);
  if (!plan) throw new Error('No split has that code. Check it with your partner.');
  if (!plan.members.includes(uid)) {
    if (plan.members.length >= MAX_MEMBERS) throw new Error('That split is already shared with the most people it can be.');
    await remote.join(code);
    plan = (await remote.get(code)) ?? plan;
  }
  const mine = (await db.programs.toArray()).find((p) => p.shareCode === code);
  const program = await applyPlan(code, plan, mine?.id);
  await updateSettings({ activeProgramId: program.id, nextDayIndex: 0 });
  return program;
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
}

/** True when the split follows a shared plan. */
export const isShared = (p?: Program) => !!p?.shareCode;
