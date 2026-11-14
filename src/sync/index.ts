import { useSyncExternalStore } from 'react';
import { cloudAvailable } from './config';
import { clearSyncState, getSyncState, isSyncing, pendingCount, setSyncState, subscribe, syncNow, trackChanges } from './engine';

type Fb = typeof import('./firebase');
let fb: Promise<Fb> | null = null;
const loadFb = () => (fb ??= import('./firebase'));

let lastError = '';
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const ping = () => listeners.forEach((l) => l());

async function run() {
  const state = getSyncState();
  if (!cloudAvailable || !state.uid || typeof navigator !== 'undefined' && navigator.onLine === false) return;
  try {
    const f = await loadFb();
    await syncNow(f.remoteFor(state.uid));
    lastError = '';
  } catch (e) {
    lastError = friendly(e);
  }
  ping();
}

/** Syncs a few seconds after changes stop, so a burst of set logging becomes one upload. */
function soon(ms = 3000) {
  clearTimeout(timer);
  timer = setTimeout(run, ms);
}

/** Starts cloud sync if this phone is signed in. Call once at startup. */
export function startSync() {
  if (!cloudAvailable) return;
  trackChanges(() => soon());
  document.addEventListener('visibilitychange', () => {
    // Coming back: fetch what the other phone did. Leaving: send what's waiting right away.
    if (document.visibilityState === 'visible') soon(0);
    else if (pendingCount()) run();
  });
  window.addEventListener('online', () => soon(0));
  if (!getSyncState().uid) return;
  loadFb().then((f) => {
    f.onAuthStateChanged(f.auth, (user) => {
      if (!user) clearSyncState();
      else soon(0);
      ping();
    });
  }).catch(() => {});
}

function friendly(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-email': 'That email address doesn\'t look right.',
    'auth/missing-password': 'Enter your password.',
    'auth/weak-password': 'Use at least 6 characters for the password.',
    'auth/email-already-in-use': 'There\'s already an account with that email. Sign in instead.',
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/wrong-password': 'Wrong email or password.',
    'auth/user-not-found': 'No account with that email. Create one instead.',
    'auth/too-many-requests': 'Too many tries. Wait a minute and try again.',
    'auth/network-request-failed': 'No internet connection.',
    'permission-denied': 'The cloud refused access. Try signing out and in again.',
    unavailable: 'Couldn\'t reach the cloud. It will try again later.',
  };
  return map[code] ?? ((e as Error)?.message || 'Something went wrong.');
}

async function signedIn(uid: string, email: string | null) {
  setSyncState({ uid, email: email ?? undefined, merged: false, cursor: null });
  await run();
  if (lastError) throw new Error(lastError);
}

export async function signIn(email: string, password: string, create: boolean) {
  const f = await loadFb();
  try {
    const { user } = create
      ? await f.createUserWithEmailAndPassword(f.auth, email.trim(), password)
      : await f.signInWithEmailAndPassword(f.auth, email.trim(), password);
    await signedIn(user.uid, user.email);
  } catch (e) {
    throw new Error(friendly(e));
  }
}

export async function resetPassword(email: string) {
  const f = await loadFb();
  try {
    await f.sendPasswordResetEmail(f.auth, email.trim());
  } catch (e) {
    throw new Error(friendly(e));
  }
}

/** Signs out. This phone keeps its data; it just stops syncing. */
export async function signOutNow() {
  await run();
  const f = await loadFb();
  await f.signOut(f.auth);
  clearSyncState();
  ping();
}

export const syncAgain = () => run();

export interface AccountView {
  available: boolean;
  email?: string;
  signedIn: boolean;
  syncing: boolean;
  lastSyncAt?: number;
  pending: number;
  error: string;
}

let cached: AccountView | null = null;
let cachedKey = '';
function snapshot(): AccountView {
  const s = getSyncState();
  const view: AccountView = {
    available: cloudAvailable, email: s.email, signedIn: !!s.uid, syncing: isSyncing(),
    lastSyncAt: s.lastSyncAt, pending: pendingCount(), error: lastError,
  };
  const key = JSON.stringify(view);
  if (key !== cachedKey) {
    cachedKey = key;
    cached = view;
  }
  return cached!;
}

function sub(l: () => void) {
  listeners.add(l);
  const off = subscribe(l);
  return () => {
    listeners.delete(l);
    off();
  };
}

/** Account and sync status for the UI. */
export function useAccount(): AccountView {
  return useSyncExternalStore(sub, snapshot);
}
