import type { PlannedExercise, Workout } from '../types';
import { MOVE_BY_ID, MOVES, TARGETS, type Equipment, type Group, type Move, type Target } from './targets';

/**
 * Catching up on missed muscle areas. When the last workout of the same kind (the last push day before
 * this push day) left part of a muscle untrained, because an exercise was skipped or the plan simply
 * doesn't cover it, this push day moves the exercises that train it to the front, while you're
 * fresh, or adds one exercise for it if nothing planned does.
 */

/** Hit this hard counts as trained. Matches what the routine preview calls covered. */
const TRAINED = 0.6;
const TIER: Record<Equipment, number> = { bodyweight: 0, dumbbells: 1, gym: 2 };

/** The muscle groups an exercise list mainly works, from the tagged exercises in it. */
export function mainGroups(exerciseIds: string[]): Set<Group> {
  const groups = new Set<Group>();
  for (const id of exerciseIds) {
    for (const [t, w] of Object.entries(MOVE_BY_ID.get(id)?.hits ?? {}) as [Target, number][]) {
      if (w >= 0.8) groups.add(TARGETS[t].group);
    }
  }
  return groups;
}

/** How hard each area was trained in a finished workout, counting only exercises with a done work set. */
export function trainedIn(w: Workout): Partial<Record<Target, number>> {
  const out: Partial<Record<Target, number>> = {};
  for (const e of w.exercises) {
    if (!e.sets.some((s) => s.done && s.type !== 'warmup')) continue;
    for (const [t, h] of Object.entries(MOVE_BY_ID.get(e.exerciseId)?.hits ?? {}) as [Target, number][]) {
      out[t] = (out[t] ?? 0) + h;
    }
  }
  return out;
}

/** Same kind of day: most of the main muscle groups in common (push with push, legs with lower). */
function similar(a: Set<Group>, b: Set<Group>): boolean {
  if (!a.size || !b.size) return false;
  const shared = [...a].filter((g) => b.has(g)).length;
  return shared / new Set([...a, ...b]).size >= 0.5;
}

/** The most recent finished workout of the same kind as this planned day. */
export function lastSimilar(planned: PlannedExercise[], finished: Workout[]): Workout | undefined {
  const groups = mainGroups(planned.map((p) => p.exerciseId));
  return [...finished]
    .filter((w) => w.finishedAt)
    .sort((a, b) => b.startedAt - a.startedAt)
    .find((w) => similar(groups, mainGroups(w.exercises.map((e) => e.exerciseId))));
}

/** Areas this kind of day is meant to train that the last one didn't, most important first. */
export function missedTargets(planned: PlannedExercise[], last: Workout | undefined): Target[] {
  if (!last) return [];
  const groups = mainGroups(planned.map((p) => p.exerciseId));
  const trained = trainedIn(last);
  return (Object.keys(TARGETS) as Target[])
    .filter((t) => groups.has(TARGETS[t].group) && TARGETS[t].priority >= 0.5 && (trained[t] ?? 0) < TRAINED)
    .sort((a, b) => TARGETS[b].priority - TARGETS[a].priority);
}

const label = (ts: Target[]) => ts.map((t) => TARGETS[t].label.toLowerCase()).join(' and ');

export interface CatchUpExercise extends PlannedExercise {
  /** Why it was moved up or added, shown on the exercise during the workout. */
  catchUpNote?: string;
}

/**
 * Reorders the day so exercises for missed areas come first (compound lifts still lead), and adds one
 * exercise for whatever no planned exercise covers, using kit the plan already relies on.
 */
export function applyCatchUp(
  planned: PlannedExercise[],
  missed: Target[],
  lastName: string,
  available: (exerciseId: string) => boolean = () => true,
): CatchUpExercise[] {
  if (!missed.length) return planned;
  const why = `missed on your last ${lastName}`;
  const covers = (id: string) => missed.filter((t) => (MOVE_BY_ID.get(id)?.hits[t] ?? 0) >= TRAINED);

  const out: CatchUpExercise[] = planned.map((p) => {
    const c = covers(p.exerciseId);
    return c.length ? { ...p, catchUpNote: `Moved up: ${label(c)} ${why}` } : { ...p };
  });
  const tagged = (p: PlannedExercise) => MOVE_BY_ID.get(p.exerciseId);
  const isCompound = (p: PlannedExercise) => tagged(p)?.compound ?? false;
  // Catch-up compounds lead the day; catch-up isolation goes ahead of the other isolation work.
  // Everything else keeps the user's order.
  const leadCompounds = out.filter((p) => p.catchUpNote && isCompound(p));
  const leadIsolation = out.filter((p) => p.catchUpNote && !isCompound(p));
  const rest = out.filter((p) => !p.catchUpNote);
  const firstIso = rest.findIndex((p) => tagged(p) && !isCompound(p));
  const isoAt = firstIso < 0 ? rest.length : firstIso;
  const build = (extraCompound: CatchUpExercise[], extraIso: CatchUpExercise[]) => [
    ...leadCompounds, ...extraCompound, ...rest.slice(0, isoAt), ...leadIsolation, ...extraIso, ...rest.slice(isoAt),
  ];
  // Only something that actually moved earlier is "moved up".
  const ordered = build([], []);
  for (const [i, p] of ordered.entries()) {
    if (p.catchUpNote && out.indexOf(p) <= i) p.catchUpNote = p.catchUpNote.replace('Moved up: ', 'Focus: ');
  }

  const uncovered = missed.filter((t) => !planned.some((p) => covers(p.exerciseId).includes(t)));
  if (!uncovered.length) return ordered;
  const tags = planned.map((p) => MOVE_BY_ID.get(p.exerciseId)).filter((m): m is Move => !!m);
  const maxTier = tags.length ? Math.max(...tags.map((m) => TIER[m.eq])) : TIER.gym;
  const usedPatterns = new Set(tags.map((m) => m.pattern));
  const inPlan = new Set(planned.map((p) => p.exerciseId));
  const score = (m: Move) =>
    uncovered.reduce((s, t) => s + (m.hits[t] ?? 0) * TARGETS[t].priority, 0) * m.quality * (usedPatterns.has(m.pattern) ? 0.6 : 1);
  const best = MOVES
    .filter((m) => !inPlan.has(m.id) && TIER[m.eq] <= maxTier && available(m.id) && uncovered.some((t) => (m.hits[t] ?? 0) >= TRAINED))
    .map((m) => [score(m), m] as const)
    .sort((a, b) => b[0] - a[0])[0]?.[1];
  if (!best) return ordered;
  const extra: CatchUpExercise = {
    exerciseId: best.id,
    sets: 3,
    repMin: best.compound ? 8 : 10,
    repMax: best.compound ? 12 : 15,
    rest: best.compound ? 120 : 75,
    catchUpNote: `Added: ${label(uncovered.filter((t) => (best.hits[t] ?? 0) >= TRAINED))} ${why}`,
  };
  return best.compound ? build([extra], []) : build([], [extra]);
}
