import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_SETTINGS, db } from './db';
import type { Workout } from './types';

export function useSettings() {
  return useLiveQuery(() => db.settings.get('me'), []) ?? DEFAULT_SETTINGS;
}

/** Finished workouts, newest first. undefined while loading. */
export function useFinished(): Workout[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.workouts.orderBy('startedAt').reverse().toArray();
    return all.filter((w) => w.finishedAt);
  }, []);
}

export function useActiveWorkout() {
  return useLiveQuery(async () => (await db.workouts.toArray()).find((w) => !w.finishedAt) ?? null, []);
}
