import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

// A tiny localStorage for node.
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
};

const { db, initDb, logBodyWeight, updateSettings } = await import('../db');
const { getOutbox, setSyncState, syncNow, trackChanges, clearSyncState } = await import('./engine');
import type { Remote, RemoteRow } from './engine';

/** An in-memory cloud: one map per account, with a change counter as the timestamp. */
function fakeCloud() {
  const docs = new Map<string, RemoteRow & { t: number }>();
  let clock = 0;
  const remote: Remote = {
    async pull(cursor) {
      const since = cursor ? Number(cursor) : 0;
      const rows = [...docs.values()].filter((d) => d.t > since).sort((a, b) => a.t - b.t);
      return { rows: rows.map(({ table, key, data }) => ({ table, key, data })), cursor: String(Math.max(since, ...rows.map((r) => r.t))) };
    },
    async push(rows) {
      for (const r of rows) docs.set(`${r.table}/${r.key}`, { ...r, t: ++clock });
    },
  };
  return { remote, docs };
}

/** Wipes "this phone" so the next steps act like a different device. */
async function newPhone() {
  clearSyncState();
  await db.delete();
  await db.open();
  await initDb();
}

const workout = (id: string, startedAt = 1) => ({ id, name: `W ${id}`, startedAt, finishedAt: startedAt + 1, exercises: [] });

beforeEach(async () => {
  trackChanges();
  await newPhone();
});

describe('cloud sync', () => {
  it('does not track changes while signed out', async () => {
    await db.workouts.put(workout('a'));
    expect(Object.keys(getOutbox())).toHaveLength(0);
  });

  it('uploads existing phone data on first sign-in, but not built-in splits', async () => {
    const { remote, docs } = fakeCloud();
    await db.workouts.put(workout('a'));
    await logBodyWeight(80);
    setSyncState({ uid: 'u1' });
    await syncNow(remote);
    const tables = [...docs.values()].map((d) => d.table);
    expect(tables).toContain('workouts');
    expect(tables).toContain('bodyWeight');
    expect(tables).toContain('settings');
    expect(tables).not.toContain('programs');
    expect(Object.keys(getOutbox())).toHaveLength(0);
  });

  it('brings history and settings to a new phone, and the account wins over its defaults', async () => {
    const { remote } = fakeCloud();
    await db.workouts.put(workout('a'));
    await updateSettings({ name: 'Nacho', units: 'lb' });
    setSyncState({ uid: 'u1' });
    await syncNow(remote);

    await newPhone();
    await db.workouts.put(workout('local-only'));
    setSyncState({ uid: 'u1' });
    await syncNow(remote);
    expect((await db.settings.get('me'))?.name).toBe('Nacho');
    expect((await db.settings.get('me'))?.units).toBe('lb');
    expect((await db.workouts.toArray()).map((w) => w.id).sort()).toEqual(['a', 'local-only']);
  });

  it('sends edits and deletes, and another phone picks them up', async () => {
    const { remote } = fakeCloud();
    setSyncState({ uid: 'u1' });
    await syncNow(remote);
    await db.workouts.bulkPut([workout('a'), workout('b')]);
    await new Promise((r) => setTimeout(r));
    expect(Object.keys(getOutbox())).toHaveLength(2);
    await syncNow(remote);

    // Phone B
    await newPhone();
    setSyncState({ uid: 'u1' });
    await syncNow(remote);
    expect(await db.workouts.count()).toBe(2);
    // Snapshot phone B's state; then phone A edits.
    const phoneB = localStorage.getItem('sync-state');

    await db.transaction('rw', db.workouts, async () => {
      await db.workouts.update('a', { name: 'Push day' });
      await db.workouts.delete('b');
    });
    await syncNow(remote);
    expect(await db.workouts.count()).toBe(1);

    // Back on a phone that only knew the old state: an incremental pull applies the change.
    localStorage.setItem('sync-state', phoneB!);
    await db.workouts.bulkPut([workout('a'), workout('b')]);
    localStorage.removeItem('sync-outbox');
    await syncNow(remote);
    expect((await db.workouts.get('a'))?.name).toBe('Push day');
    expect(await db.workouts.get('b')).toBeUndefined();
  });

  it('keeps a local edit that has not been uploaded yet over an older cloud copy', async () => {
    const { remote } = fakeCloud();
    setSyncState({ uid: 'u1' });
    await syncNow(remote);
    await remote.push([{ table: 'workouts', key: 'a', data: JSON.stringify(workout('a')) }]);
    await db.workouts.put({ ...workout('a'), name: 'Mine' });
    await syncNow(remote);
    expect((await db.workouts.get('a'))?.name).toBe('Mine');
  });
});
