import type { Day, Exercise, Workout } from '../types';
import { GROUP_LABEL, groupCredit, MOVE_BY_ID, type Group } from './targets';

/** Hard sets on a muscle in the last two days that call for a rest before training it again. */
export const HARD_SETS = 6;
export const RECOVERY_HOURS = 48;

const LIBRARY_GROUP: Record<string, Group> = {
  chest: 'chest', shoulders: 'delts', triceps: 'triceps', biceps: 'biceps', lats: 'back', 'middle back': 'back',
  traps: 'traps', 'lower back': 'lowerBack', quadriceps: 'quads', hamstrings: 'hams', glutes: 'glutes', calves: 'calves', abdominals: 'core',
};

/** Muscle groups an exercise works, a full set for main targets and half for secondary ones. */
export function exerciseGroups(exerciseId: string, byId: Map<string, Exercise>): Map<Group, number> {
  const mv = MOVE_BY_ID.get(exerciseId);
  if (mv) return groupCredit(mv);
  const out = new Map<Group, number>();
  const ex = byId.get(exerciseId);
  for (const m of ex?.secondaryMuscles ?? []) if (LIBRARY_GROUP[m]) out.set(LIBRARY_GROUP[m], 0.5);
  for (const m of ex?.primaryMuscles ?? []) if (LIBRARY_GROUP[m]) out.set(LIBRARY_GROUP[m], 1);
  return out;
}

/** Hard (ticked, non-warm-up) sets per muscle group in the last 48 hours. */
export function recentLoad(finished: Workout[], byId: Map<string, Exercise>, now = Date.now()): Map<Group, number> {
  const out = new Map<Group, number>();
  for (const w of finished) {
    if (!w.finishedAt || now - w.startedAt > RECOVERY_HOURS * 36e5 || w.startedAt > now) continue;
    for (const e of w.exercises) {
      const n = e.sets.filter((s) => s.done && s.type !== 'warmup').length;
      if (!n) continue;
      for (const [g, c] of exerciseGroups(e.exerciseId, byId)) out.set(g, (out.get(g) ?? 0) + n * c);
    }
  }
  return out;
}

/** The muscles a day mainly trains. */
function dayGroups(day: Day, byId: Map<string, Exercise>): Group[] {
  const groups = new Set<Group>();
  for (const e of day.exercises) for (const [g, c] of exerciseGroups(e.exerciseId, byId)) if (c === 1) groups.add(g);
  return [...groups];
}

/** Main muscles of this day that were trained hard in the last 48 hours, most-worked first. */
export function tiredGroups(day: Day, load: Map<Group, number>, byId: Map<string, Exercise>): Group[] {
  return dayGroups(day, byId).filter((g) => (load.get(g) ?? 0) >= HARD_SETS).sort((a, b) => load.get(b)! - load.get(a)!);
}

/** Another day of the program whose muscles are all rested, nearest after `day` in program order. */
export function fresherDay(days: Day[], day: Day, load: Map<Group, number>, byId: Map<string, Exercise>): Day | undefined {
  const i = days.indexOf(day);
  const order = [...days.slice(i + 1), ...days.slice(0, Math.max(0, i))];
  return order.find((d) => d !== day && tiredGroups(d, load, byId).length === 0);
}

export function recoveryNote(tired: Group[], load: Map<Group, number>): string {
  const names = tired.map((g) => GROUP_LABEL[g].toLowerCase());
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  const sets = Math.round(Math.max(...tired.map((g) => load.get(g) ?? 0)));
  return `Your ${list} got up to ${sets} hard sets in the last 2 days, so ${names.length > 1 ? 'they' : 'it'} may still be recovering.`;
}
