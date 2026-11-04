import type { Day, Workout } from '../types';
import { MOVE_BY_ID, MOVES, similarity, type Equipment, type Move } from './targets';

/**
 * Accessory rotation: main lifts stay put so you can keep adding weight, but an isolation exercise
 * that's been in the same day for about 5 weeks gets swapped for one that trains the same area,
 * for a fresh stimulus.
 */
export const ROTATE_AFTER_DAYS = 35;
export const ROTATE_AFTER_SESSIONS = 4;
const DAY = 864e5;
const TIER: Record<Equipment, number> = { bodyweight: 0, dumbbells: 1, gym: 2 };

export interface Rotation { from: string; to: Move }

export function rotationsFor(day: Day, finished: Workout[], now = Date.now(), available: (id: string) => boolean = () => true): Rotation[] {
  const sessions = finished.filter((w) => w.finishedAt && w.dayId === day.id).sort((a, b) => b.startedAt - a.startedAt);
  const tags = day.exercises.map((p) => MOVE_BY_ID.get(p.exerciseId)).filter((m): m is Move => !!m);
  const maxTier = tags.length ? Math.max(...tags.map((m) => TIER[m.eq])) : TIER.gym;
  const taken = new Set(day.exercises.map((p) => p.exerciseId));
  const out: Rotation[] = [];
  for (const p of day.exercises) {
    const mv = MOVE_BY_ID.get(p.exerciseId);
    if (!mv || mv.compound || p.scheme) continue;
    // The unbroken run of recent sessions of this day that included it.
    let run = 0;
    while (run < sessions.length && sessions[run].exercises.some((e) => e.exerciseId === p.exerciseId)) run++;
    if (run < ROTATE_AFTER_SESSIONS || now - sessions[run - 1].startedAt < ROTATE_AFTER_DAYS * DAY) continue;
    const to = MOVES
      .filter((m) => !m.compound && !taken.has(m.id) && TIER[m.eq] <= maxTier && available(m.id))
      .map((m) => [similarity(mv, m) * (0.8 + 0.2 * m.quality), m] as const)
      .filter(([s]) => s >= 0.6)
      .sort((a, b) => b[0] - a[0])[0]?.[1];
    if (!to) continue;
    taken.add(to.id);
    out.push({ from: p.exerciseId, to });
  }
  return out;
}

/** The day with each rotated exercise replaced in place, keeping its sets, reps and rest. */
export function applyRotations(day: Day, rotations: Rotation[]): Day {
  if (!rotations.length) return day;
  const map = new Map(rotations.map((r) => [r.from, r.to.id]));
  return { ...day, exercises: day.exercises.map((p) => (map.has(p.exerciseId) ? { ...p, exerciseId: map.get(p.exerciseId)! } : p)) };
}
