import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator, createUserWithEmailAndPassword, getAuth, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut,
  type User,
} from 'firebase/auth';
import {
  Timestamp, arrayUnion, collection, connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc, initializeFirestore, orderBy, query, serverTimestamp, where, writeBatch,
} from 'firebase/firestore';
import { firebaseConfig } from './config';
import type { Remote, RemoteRow } from './engine';
import type { ShareRemote } from './share';

// Loaded only when cloud sync is in use, so the app stays small and fast for everyone else.
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const store = initializeFirestore(app, {});
// For local testing against the Firebase emulators: VITE_FIREBASE_EMULATOR=1 npm run dev
if (import.meta.env.VITE_FIREBASE_EMULATOR) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(store, '127.0.0.1', 8080);
}

export { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut };
export type { User };

const later = (a: Timestamp, b: Timestamp) => a.seconds > b.seconds || (a.seconds === b.seconds && a.nanoseconds > b.nanoseconds);

/** Each row is one document under users/{uid}/rows, so one query fetches everything that changed. */
export function remoteFor(uid: string): Remote {
  const rows = collection(store, 'users', uid, 'rows');
  const docId = (r: RemoteRow) => `${r.table}~${encodeURIComponent(r.key)}`;
  return {
    async pull(cursor) {
      const after = cursor ? (() => { const [s, n] = cursor.split(':').map(Number); return new Timestamp(s, n); })() : null;
      const snap = await getDocs(after ? query(rows, where('updatedAt', '>', after), orderBy('updatedAt')) : query(rows));
      let last = after;
      const out: RemoteRow[] = [];
      snap.forEach((d) => {
        const v = d.data() as { table: string; key: string; data: string | null; updatedAt?: Timestamp };
        out.push({ table: v.table, key: v.key, data: v.data ?? null });
        if (v.updatedAt && (!last || later(v.updatedAt, last))) last = v.updatedAt;
      });
      return { rows: out, cursor: last ? `${last.seconds}:${last.nanoseconds}` : cursor };
    },
    async push(list) {
      for (let i = 0; i < list.length; i += 400) {
        const batch = writeBatch(store);
        for (const r of list.slice(i, i + 400)) {
          batch.set(doc(rows, docId(r)), { table: r.table, key: r.key, data: r.data, deleted: r.data == null, updatedAt: serverTimestamp() });
        }
        await batch.commit();
      }
    },
  };
}

/** Shared splits live in shared/{code}. Anyone signed in who knows the code can read it and join; only members can change it. */
export function shareRemoteFor(uid: string): ShareRemote {
  const ref = (code: string) => doc(store, 'shared', code);
  return {
    async get(code) {
      const snap = await getDoc(ref(code));
      if (!snap.exists()) return null;
      const v = snap.data() as { owner: string; members: string[]; program: string; exercises?: string; updatedAt?: Timestamp };
      const t = v.updatedAt;
      return { owner: v.owner, members: v.members ?? [], program: v.program, exercises: v.exercises ?? '[]', version: t ? `${t.seconds}:${t.nanoseconds}` : '' };
    },
    async create(code, plan) {
      await setDoc(ref(code), { owner: uid, members: [uid], ...plan, by: uid, updatedAt: serverTimestamp() });
    },
    async join(code) {
      await updateDoc(ref(code), { members: arrayUnion(uid) });
    },
    async update(code, plan) {
      await updateDoc(ref(code), { ...plan, by: uid, updatedAt: serverTimestamp() });
    },
    async remove(code) {
      await deleteDoc(ref(code));
    },
  };
}
