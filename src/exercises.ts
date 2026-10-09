import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { ALIASES, EXTRA_EXERCISES, SIMILAR_PHOTOS } from './data/extraExercises';
import type { Exercise } from './types';

/** Pinned commit of github.com/yuhonas/free-exercise-db (public domain). Keep in sync with scripts/build-exercises.mjs. */
export const FEDB_COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5';
const CDN = `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${FEDB_COMMIT}/exercises/`;
const FALLBACK = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${FEDB_COMMIT}/exercises/`;

export const imageUrl = (path: string, fallback = false) => (fallback ? FALLBACK : CDN) + path;

let libraryPromise: Promise<Exercise[]> | null = null;

export function loadLibrary(): Promise<Exercise[]> {
  libraryPromise ??= fetch(`${import.meta.env.BASE_URL}exercises.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load exercises (${r.status})`);
      return r.json() as Promise<Exercise[]>;
    })
    .then(withExtras)
    .catch((e) => {
      libraryPromise = null;
      throw e;
    });
  return libraryPromise;
}

/** Adds the app's own exercises and everyday-name aliases to the free-exercise-db list. */
export function withExtras(library: Exercise[]): Exercise[] {
  const byName = new Map(library.map((e) => [e.name, e]));
  // Extras have no photos of their own; borrow a similar movement's, labelled as such.
  const extras = EXTRA_EXERCISES.map((e) => {
    const similar = byName.get(SIMILAR_PHOTOS[e.name]);
    return similar?.images.length ? { ...e, images: similar.images, similarTo: similar.name } : e;
  });
  return [...library, ...extras]
    .map((e) => (ALIASES[e.id] ? { ...e, aliases: ALIASES[e.id] } : e))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Built-in library merged with the user's custom exercises, plus an id lookup. */
export function useExercises() {
  const [library, setLibrary] = useState<Exercise[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const custom = useLiveQuery(() => db.customExercises.toArray(), []);

  useEffect(() => {
    loadLibrary().then(setLibrary, (e: Error) => setError(e.message));
  }, []);

  return useMemo(() => {
    const all = [...(custom ?? []), ...(library ?? [])];
    const byId = new Map(all.map((e) => [e.id, e]));
    return { all, byId, loading: !library && !error, error };
  }, [library, custom, error]);
}

export const MUSCLES = [
  'chest', 'shoulders', 'triceps', 'biceps', 'forearms', 'lats', 'middle back', 'lower back', 'traps',
  'abdominals', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors', 'neck',
];

export const EQUIPMENT = [
  'barbell', 'dumbbell', 'cable', 'machine', 'body only', 'kettlebells', 'bands', 'e-z curl bar',
  'medicine ball', 'exercise ball', 'foam roll', 'other',
];

export const exerciseName = (byId: Map<string, Exercise>, id: string) =>
  byId.get(id)?.name ?? id.replace(/_/g, ' ');

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
