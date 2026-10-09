import type { Exercise, Workout } from '../types';
import { GENERATOR_EXERCISES } from './generator';
import { hasGear } from './equipment';

const STRENGTH = new Set(['strength', 'powerlifting', 'olympic weightlifting', 'strongman']);
const COMMON = new Set(['barbell', 'dumbbell', 'cable', 'machine']);
const CURATED = new Set(GENERATOR_EXERCISES);
const DAY = 864e5;

/**
 * True when this exercise was in every one of the last `runs` workouts that trained its main muscle,
 * i.e. the user keeps doing the same thing and could use a change.
 */
export function isStale(ex: Exercise | undefined, finished: Workout[], byId: Map<string, Exercise>, runs = 4): boolean {
  const muscle = ex?.primaryMuscles[0];
  if (!ex || !muscle) return false;
  const sessions = [...finished]
    .filter((w) => w.finishedAt && w.exercises.some((e) => byId.get(e.exerciseId)?.primaryMuscles[0] === muscle))
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, runs);
  return sessions.length === runs && sessions.every((w) => w.exercises.some((e) => e.exerciseId === ex.id));
}

/**
 * Other exercises for the same main muscle, freshest first: things not done lately, the same kind of
 * movement (compound/isolation), common gym kit and well-known lifts. Picks spread across equipment
 * types so the options feel different from each other.
 */
export function freshAlternatives(
  ex: Exercise,
  all: Exercise[],
  finished: Workout[],
  missing: readonly string[] | undefined,
  count = 3,
  now = Date.now(),
): Exercise[] {
  const muscle = ex.primaryMuscles[0];
  if (!muscle) return [];
  const lastDone = new Map<string, number>();
  for (const w of finished) for (const e of w.exercises) lastDone.set(e.exerciseId, Math.max(lastDone.get(e.exerciseId) ?? 0, w.startedAt));
  const recent = (id: string) => now - (lastDone.get(id) ?? 0) < 21 * DAY;

  const candidates = all.filter((c) =>
    c.id !== ex.id && c.primaryMuscles[0] === muscle && (c.custom || STRENGTH.has(c.category)) && hasGear(c, missing));
  const score = (c: Exercise) =>
    (recent(c.id) ? 100 : 0) +
    (CURATED.has(c.id) ? 0 : 20) +
    (c.mechanic && ex.mechanic && c.mechanic !== ex.mechanic ? 10 : 0) +
    (COMMON.has(c.equipment) ? 0 : c.equipment === 'body only' ? 3 : 6) +
    (c.level === 'expert' ? 5 : 0);
  const ranked = candidates.map((c) => [score(c), c] as const).sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name)).map(([, c]) => c);

  const out: Exercise[] = [];
  const kinds = new Set([ex.equipment]);
  // Only the strongest options compete for variety, so an obscure lift never beats a good one just for its kit.
  for (const c of ranked.slice(0, count * 3)) {
    if (out.length >= count) break;
    if (!kinds.has(c.equipment)) { out.push(c); kinds.add(c.equipment); }
  }
  for (const c of ranked) {
    if (out.length >= count) break;
    if (!out.includes(c)) out.push(c);
  }
  return out;
}
