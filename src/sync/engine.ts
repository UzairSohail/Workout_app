import type { Table, Transaction } from 'dexie';
import { db } from '../db';

/**
 * Local-first cloud sync. The phone's own database stays the source the app reads from; this module
 * records which rows changed, sends them up, and brings down rows changed on other devices.
 * Each row travels as JSON with a server timestamp, so the last device to save a row wins.
 */

/** Tables that follow the account. Exercise photos stay on the phone (they are large). */
export const SYNCED_TABLES = [
  'settings', 'programs', 'workouts', 'customExercises', 'programState', 'bodyWeight', 'exerciseNotes', 'savedWorkouts',
] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];

export interface RemoteRow {
  table: string;
  key: string;
  /** JSON of the row, or null when it was deleted. */
  data: string | null;
}

export interface Remote {
  /** Rows changed since the cursor (all rows when null), and the cursor to use next time. */
  pull(cursor: string | null): Promise<{ rows: RemoteRow[]; cursor: string | null }>;
  push(rows: RemoteRow[]): Promise<void>;
}

interface SyncState {
  uid: string | null;
  email?: string;
  /** Set once this phone's data has been merged with the account. */
  merged?: boolean;
  cursor?: string | null;
  lastSyncAt?: number;
}

const STATE_KEY = 'sync-state';
const OUTBOX_KEY = 'sync-outbox';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked */
  }
}

export const getSyncState = (): SyncState => read<SyncState>(STATE_KEY, { uid: null });
export function setSyncState(patch: Partial<SyncState>) {
  write(STATE_KEY, { ...getSyncState(), ...patch });
  notify();
}
export function clearSyncState() {
  try {
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem(OUTBOX_KEY);
  } catch {
    /* ignore */
  }
  notify();
}

// ---- Change tracking -------------------------------------------------------

/** Pending changes: "table\u0001key" → a counter, so a change made during a push is not dropped. */
type Outbox = Record<string, number>;
const SEP = '\u0001';
let seq = 0;
let pending: Outbox | null = null;
const listeners = new Set<() => void>();
let onChange: (() => void) | null = null;

function notify() {
  listeners.forEach((l) => l());
}
export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export const getOutbox = (): Outbox => ({ ...read<Outbox>(OUTBOX_KEY, {}), ...(pending ?? {}) });
export const pendingCount = () => Object.keys(getOutbox()).length;

function enqueue(table: string, key: unknown) {
  if (typeof key !== 'string' && typeof key !== 'number') return;
  if (!pending) {
    pending = {};
    queueMicrotask(flushPending);
  }
  pending[table + SEP + String(key)] = Date.now() * 1000 + (++seq % 1000);
}
function flushPending() {
  if (!pending) return;
  write(OUTBOX_KEY, { ...read<Outbox>(OUTBOX_KEY, {}), ...pending });
  pending = null;
  notify();
  onChange?.();
}

const REMOTE_TX = '__fromCloud';
const isRemote = (tx: Transaction | undefined) => !!tx && !!(tx as unknown as Record<string, unknown>)[REMOTE_TX];
const builtIn = (table: string, obj: unknown) => table === 'programs' && !!(obj as { builtIn?: boolean } | undefined)?.builtIn;

let tracking = false;
/** Watches the synced tables. Changes count only while signed in; `changed` runs after each batch. */
export function trackChanges(changed?: () => void) {
  onChange = changed ?? null;
  if (tracking) return;
  tracking = true;
  for (const name of SYNCED_TABLES) {
    const table = db.table(name);
    const keyPath = table.schema.primKey.keyPath as string;
    const on = (tx: Transaction | undefined, key: unknown, obj: unknown) => {
      if (!getSyncState().uid || isRemote(tx) || builtIn(name, obj)) return;
      enqueue(name, key ?? (obj as Record<string, unknown> | undefined)?.[keyPath]);
    };
    table.hook('creating', (key, obj, tx) => on(tx, key, obj));
    table.hook('updating', (_mods, key, obj, tx) => on(tx, key, obj));
    table.hook('deleting', (key, obj, tx) => on(tx, key, obj));
  }
}

// ---- Sync --------------------------------------------------------------------

const tables = () => SYNCED_TABLES.map((t) => db.table(t));

/** Writes rows from the cloud without marking them as local changes. Rows with local edits waiting keep the local copy. */
async function applyRemote(rows: RemoteRow[], skip: Set<string>) {
  if (!rows.length) return;
  await db.transaction('rw', tables(), async (tx) => {
    (tx as unknown as Record<string, unknown>)[REMOTE_TX] = true;
    for (const r of rows) {
      if (!(SYNCED_TABLES as readonly string[]).includes(r.table) || skip.has(r.table + SEP + r.key)) continue;
      const table: Table = db.table(r.table);
      if (r.data == null) await table.delete(r.key);
      else await table.put(JSON.parse(r.data));
    }
  });
}

async function localRow(table: string, key: string): Promise<RemoteRow | null> {
  const row = await db.table(table).get(key);
  if (builtIn(table, row)) return null;
  return { table, key, data: row ? JSON.stringify(row) : null };
}

async function push(remote: Remote) {
  flushPending();
  const box = getOutbox();
  const entries = Object.entries(box);
  if (!entries.length) return;
  const rows: RemoteRow[] = [];
  for (const [id] of entries) {
    const [table, key] = id.split(SEP);
    const row = await localRow(table, key);
    if (row) rows.push(row);
  }
  await remote.push(rows);
  // Drop what was sent, unless it changed again meanwhile.
  flushPending();
  const now = read<Outbox>(OUTBOX_KEY, {});
  for (const [id, n] of entries) if (now[id] === n) delete now[id];
  write(OUTBOX_KEY, now);
}

/** First sync on this phone for an account: the account's data wins where both have a row; the rest of this phone's data is uploaded. */
async function merge(remote: Remote) {
  const { rows, cursor } = await remote.pull(null);
  const inCloud = new Set(rows.map((r) => r.table + SEP + r.key));
  await applyRemote(rows, new Set());
  for (const name of SYNCED_TABLES) {
    const table = db.table(name);
    const keyPath = table.schema.primKey.keyPath as string;
    for (const obj of await table.toArray()) {
      const key = (obj as Record<string, unknown>)[keyPath];
      if (!builtIn(name, obj) && !inCloud.has(name + SEP + String(key))) enqueue(name, key);
    }
  }
  flushPending();
  await push(remote);
  setSyncState({ merged: true, cursor });
}

let running: Promise<void> | null = null;
let again = false;

/** Sends local changes and fetches changes from other devices. Calls made while a sync runs are folded into one more pass. */
export function syncNow(remote: Remote): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        const state = getSyncState();
        if (!state.uid) return;
        if (!state.merged) {
          await merge(remote);
        } else {
          await push(remote);
          const { rows, cursor } = await remote.pull(state.cursor ?? null);
          await applyRemote(rows, new Set(Object.keys(getOutbox())));
          setSyncState({ cursor });
        }
        setSyncState({ lastSyncAt: Date.now() });
      } while (again);
    } finally {
      running = null;
      notify();
    }
  })();
  notify();
  return running;
}

export const isSyncing = () => !!running;
