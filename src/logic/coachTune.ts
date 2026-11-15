import { db, getSettings } from '../db';
import type { Exercise, Workout } from '../types';
import { ask, coachOn, parseTune, setsText, TUNE_SCHEMA, tunePrompt, weightTrend, type TuneRow } from './coach';
import { historyFor, incrementFor, suggestionFor, withWarmups } from './session';
import { countedSets } from './stats';
import { deloadActive } from './deload';

const DAY = 864e5;
const tried = new Set<string>();

/**
 * Once per workout, right after it opens: asks Gemini to fine-tune today's weights for exercises with a
 * weight history, and fills them into the sets nobody has touched yet. Any failure leaves the rule-based
 * weights in place. Resolves to how many exercises were tuned.
 */
export async function tuneWorkout(workoutId: string, byId: Map<string, Exercise>): Promise<number> {
  if (tried.has(workoutId) || !coachOn()) return 0;
  tried.add(workoutId);
  const settings = await getSettings();
  if (settings.aiTune === false || deloadActive(settings)) return 0;
  const w = await db.workouts.get(workoutId);
  if (!w || w.finishedAt || w.exercises.some((e) => e.ai)) return 0;
  const finished = (await db.workouts.toArray()).filter((x) => x.finishedAt);
  const { units } = settings;

  const rows: TuneRow[] = [];
  w.exercises.forEach((le, index) => {
    if (le.scheme || le.mode === 'time' || le.deload || le.sets.some((s) => s.done)) return;
    const history = historyFor(le.exerciseId, finished, w.id).filter((h) => countedSets(h.sets).length);
    const lastTop = history.length ? Math.max(0, ...countedSets(history[0].sets).map((s) => s.weight)) : 0;
    if (!lastTop) return;
    const rule = suggestionFor(le, finished, byId, settings, w.id);
    if (rule.weight == null) return;
    const lastDone = finished.filter((x) => x.exercises.includes(history[0])).map((x) => x.startedAt)[0] ?? Date.now();
    rows.push({
      index,
      name: byId.get(le.exerciseId)?.name ?? le.exerciseId,
      repMin: le.repMin,
      repMax: le.repMax,
      increment: incrementFor(byId.get(le.exerciseId), settings),
      rule,
      lastTop,
      sessions: history.slice(0, 3).map((h) => `${setsText(h, units)}${h.feel ? ` (felt ${h.feel})` : ''}`),
      daysSince: Math.max(0, Math.round((Date.now() - lastDone) / DAY)),
    });
  });
  if (!rows.length) return 0;

  const weights = await db.bodyWeight.toArray();
  const context = [
    settings.experience ? `Lifter experience: ${settings.experience}.` : '',
    weightTrend(weights, units),
  ];
  const tuned = await ask(tunePrompt(rows, units, context), TUNE_SCHEMA, (t) => parseTune(t, rows, units), 15000);
  if (!tuned.size) return 0;

  // The workout may have changed while Gemini was thinking: only fill exercises still untouched.
  const latest = await db.workouts.get(workoutId);
  if (!latest || latest.finishedAt) return 0;
  let n = 0;
  const next: Workout = { ...latest, exercises: latest.exercises.map((le, i) => {
    const ai = tuned.get(i);
    const row = rows.find((r) => r.index === i);
    if (!ai || !row || le.exerciseId !== w.exercises[i]?.exerciseId || le.sets.some((s) => s.done)) return le;
    n++;
    const sets = le.sets
      .filter((s) => s.type !== 'warmup')
      .map((s) => (s.weight == null || s.weight === row.rule.weight ? { ...s, weight: ai.weight } : s));
    const hadWarmups = le.sets.some((s) => s.type === 'warmup');
    const out = { ...le, ai, sets };
    return hadWarmups ? withWarmups(out, byId.get(le.exerciseId), i === 0, settings) : out;
  }) };
  if (n) await db.workouts.put(next);
  return n;
}
