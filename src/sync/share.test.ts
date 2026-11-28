import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
};

const { db, initDb, getSettings } = await import('../db');
const { cleanCode, joinProgram, shareProgram, stopSharing, syncShared, showCode } = await import('./share');
import type { ShareRemote, SharedPlan } from './share';
import type { Program } from '../types';

/** One cloud both "phones" talk to; each phone gets a remote that acts as its account. */
function fakeCloud() {
  const docs = new Map<string, SharedPlan>();
  let clock = 0;
  const as = (uid: string): ShareRemote => ({
    async get(code) {
      const d = docs.get(code);
      return d ? structuredClone(d) : null;
    },
    async create(code, plan) {
      docs.set(code, { owner: uid, members: [uid], ...plan, version: String(++clock) });
    },
    async join(code) {
      const d = docs.get(code)!;
      if (!d.members.includes(uid)) d.members.push(uid);
    },
    async update(code, plan) {
      const d = docs.get(code)!;
      if (!d.members.includes(uid)) throw Object.assign(new Error('denied'), { code: 'permission-denied' });
      Object.assign(d, plan, { version: String(++clock) });
    },
    async remove(code) {
      docs.delete(code);
    },
  });
  return { docs, as };
}

/** Each phone is a separate database; switching saves and restores its rows. */
type Phone = { programs: Program[]; custom: unknown[]; settings: unknown[]; storage: Map<string, string> };
const phones: Record<string, Phone> = {};
let current = '';
async function use(name: string) {
  if (current) {
    phones[current] = {
      programs: await db.programs.toArray(), custom: await db.customExercises.toArray(), settings: await db.settings.toArray(),
      storage: new Map(mem),
    };
  }
  await db.delete();
  await db.open();
  await initDb();
  mem.clear();
  const p = phones[name];
  if (p) {
    await db.programs.bulkPut(p.programs);
    await db.customExercises.bulkPut(p.custom as never[]);
    await db.settings.bulkPut(p.settings as never[]);
    p.storage.forEach((v, k) => mem.set(k, v));
  }
  current = name;
}

const plan = (): Program => ({
  id: 'ppl', name: 'PPL', createdAt: 1,
  days: [{ id: 'd1', name: 'Push', exercises: [{ exerciseId: 'my-press', sets: 3, repMin: 8, repMax: 12, rest: 90 }] }],
});

beforeEach(async () => {
  for (const k of Object.keys(phones)) delete phones[k];
  current = '';
  await use('nacho');
});

describe('shared splits', () => {
  it('codes are 8 easy characters and typing is forgiving', async () => {
    await db.programs.put(plan());
    const cloud = fakeCloud();
    const code = await shareProgram(cloud.as('a'), 'ppl');
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    expect(cleanCode(` ${showCode(code).toLowerCase()} `)).toBe(code);
  });

  it('partner joins, gets the same exercises and custom exercises, and it becomes active', async () => {
    const cloud = fakeCloud();
    await db.programs.put(plan());
    await db.customExercises.put({ id: 'my-press', name: 'My press', primaryMuscles: ['chest'], custom: true } as never);
    const code = await shareProgram(cloud.as('a'), 'ppl');

    await use('wife');
    const got = await joinProgram(cloud.as('b'), 'b', showCode(code));
    expect(got.days).toEqual(plan().days);
    expect(got.shareCode).toBe(code);
    expect((await getSettings()).activeProgramId).toBe(got.id);
    expect(await db.customExercises.get('my-press')).toBeTruthy();
    expect(cloud.docs.get(code)!.members).toEqual(['a', 'b']);
  });

  it('edits on either phone reach the other; nothing else is shared', async () => {
    const cloud = fakeCloud();
    await db.programs.put(plan());
    const code = await shareProgram(cloud.as('a'), 'ppl');
    await use('wife');
    await joinProgram(cloud.as('b'), 'b', code);

    // Wife adds a set; it goes up, then comes down on Nacho's phone.
    const p = (await db.programs.get('ppl'))!;
    p.days[0].exercises[0].sets = 4;
    await db.programs.put(p);
    await syncShared(cloud.as('b'), 'b');
    await use('nacho');
    await syncShared(cloud.as('a'), 'a');
    expect((await db.programs.get('ppl'))!.days[0].exercises[0].sets).toBe(4);

    // Nacho renames a day; wife gets it.
    const q = (await db.programs.get('ppl'))!;
    q.days[0].name = 'Push A';
    await db.programs.put(q);
    await syncShared(cloud.as('a'), 'a');
    await use('wife');
    await syncShared(cloud.as('b'), 'b');
    const w = (await db.programs.get('ppl'))!;
    expect(w.days[0].name).toBe('Push A');
    expect(w.days[0].exercises[0].sets).toBe(4);
  });

  it('a second phone on the same account picks up the shared plan', async () => {
    const cloud = fakeCloud();
    await db.programs.put(plan());
    const code = await shareProgram(cloud.as('a'), 'ppl');
    const copy = (await db.programs.get('ppl'))!;
    await use('nacho-tablet');
    await db.programs.put(copy); // arrives through normal account sync
    cloud.docs.get(code)!.program = JSON.stringify({ ...plan(), name: 'PPL v2' });
    cloud.docs.get(code)!.version = '99';
    await syncShared(cloud.as('a'), 'a');
    expect((await db.programs.get('ppl'))!.name).toBe('PPL v2');
  });

  it('when the owner stops sharing, the partner keeps their copy', async () => {
    const cloud = fakeCloud();
    await db.programs.put(plan());
    const code = await shareProgram(cloud.as('a'), 'ppl');
    await use('wife');
    await joinProgram(cloud.as('b'), 'b', code);
    await use('nacho');
    await stopSharing(cloud.as('a'), 'a', 'ppl');
    expect(cloud.docs.has(code)).toBe(false);
    expect((await db.programs.get('ppl'))!.shareCode).toBeUndefined();
    await use('wife');
    await syncShared(cloud.as('b'), 'b');
    const kept = (await db.programs.get('ppl'))!;
    expect(kept.shareCode).toBeUndefined();
    expect(kept.days).toEqual(plan().days);
  });

  it('a wrong code says so', async () => {
    await expect(joinProgram(fakeCloud().as('b'), 'b', 'ABCD-2345')).rejects.toThrow(/No split has that code/);
    await expect(joinProgram(fakeCloud().as('b'), 'b', 'ABC')).rejects.toThrow(/8 letters/);
  });
});
