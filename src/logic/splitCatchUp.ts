import type { Day, Exercise, Program, Workout } from '../types';
import { coverDay, covers, lastSplitDay } from './generator';
import { subAreas } from './subAreas';
import { MOVE_BY_ID, TARGETS, type Target } from './targets';

export interface SplitCatchUp {
  /** Muscle parts no exercise in this round of the split trained, most important first. */
  missed: Target[];
  /** A short workout that covers them. */
  day: Day;
}

/** The id a split's catch-up workout is saved under, so it isn't offered twice for the same round. */
export const catchUpDayId = (programId: string) => `${programId}-catchup`;

/**
 * Right after the last day of a split, before it starts over: the muscle parts nothing in that round
 * trained (lats, traps, forearms, side delts, biceps long head, soleus, ...) and an optional workout for them.
 * Counts everything logged since the round started, split days or not. Undefined when nothing was
 * skipped, the round isn't finished, or its catch-up was already done.
 */
export function splitCatchUp(
  program: Pick<Program, 'id' | 'days'>,
  finished: Workout[] | undefined,
  byId: Map<string, Exercise>,
  o: { minutes: number; available?: (exerciseId: string) => boolean },
): SplitCatchUp | undefined {
  if (!finished || program.days.length < 2) return undefined;
  const last = lastSplitDay(program, finished);
  if (!last || last.index !== program.days.length - 1) return undefined;
  const done = finished.filter((w) => w.finishedAt);
  if (done.some((w) => w.programId === program.id && w.dayId === catchUpDayId(program.id) && w.startedAt > last.at)) return undefined;
  // The round started with the latest first day before its last day.
  const firstDay = program.days[0].id;
  const start = done.filter((w) => w.programId === program.id && w.dayId === firstDay && w.startedAt <= last.at)
    .reduce((t, w) => Math.max(t, w.startedAt), -Infinity);
  if (start === -Infinity) return undefined;
  const trained = new Set<Target>();
  for (const w of done) {
    if (w.startedAt < start) continue;
    for (const e of w.exercises) {
      if (!e.sets.some((x) => x.done && x.type !== 'warmup')) continue;
      const hits = subAreas(byId.get(e.exerciseId));
      for (const t of Object.keys(hits) as Target[]) if (covers({ hits }, t)) trained.add(t);
    }
  }
  const skipped = (Object.keys(TARGETS) as Target[]).filter((t) => !trained.has(t))
    .sort((a, b) => TARGETS[b].priority - TARGETS[a].priority);
  if (!skipped.length) return undefined;
  const day = coverDay(skipped, { id: catchUpDayId(program.id), name: 'Catch-up', minutes: o.minutes, available: o.available });
  const covered = skipped.filter((t) => day.exercises.some((e) => covers(MOVE_BY_ID.get(e.exerciseId) ?? { hits: {} }, t)));
  return covered.length && day.exercises.length ? { missed: covered, day } : undefined;
}
