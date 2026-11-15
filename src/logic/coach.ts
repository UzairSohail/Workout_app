/**
 * AI coach features, all powered by the user's own free Gemini key (see gemini.ts). Everything here is
 * optional: without a key, offline, or when Gemini answers something odd, the app keeps its usual rules.
 *
 * Prompts and answer checks are plain functions so they can be tested without the network.
 */
import type { BodyWeight, Exercise, LoggedExercise, PlannedExercise, Settings, Units, Workout } from '../types';
import { askGemini, geminiKey } from './gemini';
import { muscleBalance } from './balance';
import { trainingWeeks, deloadActive } from './deload';
import { daysAgo, weekStart } from './progress';
import { workoutPrs } from './records';
import { compareWorkouts, previousLike } from './summary';
import { countedSets, e1rm } from './stats';
import { MOVES, mainTargets } from './targets';
import { hasGear } from './equipment';
import { fmt, fromDisplay, roundTo, toDisplay } from './units';
import type { Suggestion } from './progression';

const DAY = 864e5;
const RULES = 'Answer in plain, friendly English, like a good gym coach talking to a regular gym-goer. No emoji, no markdown, no medical advice.';

const parse = <T>(text: string): T | null => {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};
const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** "60×8, 60×8, 60×6" in display units, or "8, 8, 6 reps" for bodyweight, "45s" for timed sets. */
export function setsText(le: LoggedExercise, units: Units): string {
  const sets = countedSets(le.sets);
  if (!sets.length) return 'no sets';
  if (le.mode === 'time') return sets.map((s) => `${s.reps}s`).join(', ');
  if (sets.every((s) => !s.weight)) return `${sets.map((s) => s.reps).join(', ')} reps`;
  return sets.map((s) => `${fmt(toDisplay(s.weight, units))}×${s.reps}`).join(', ');
}

function exerciseLine(le: LoggedExercise, name: string, units: Units): string {
  const target = le.mode === 'time' ? `${le.repMin}–${le.repMax}s` : `${le.repMin}–${le.repMax} reps`;
  return `${name}: ${setsText(le, units)} (target ${target}${le.feel ? `, felt ${le.feel}` : ''}${le.deload ? ', deload' : ''})`;
}

/** Body weight change over the last two weeks, as text, or '' when there isn't enough. */
export function weightTrend(entries: Pick<BodyWeight, 'date' | 'weight'>[], units: Units, now = Date.now()): string {
  const recent = entries.filter((e) => e.date >= now - 14 * DAY).sort((a, b) => a.date - b.date);
  if (recent.length < 3) return '';
  const avg = (xs: typeof recent) => xs.reduce((a, e) => a + e.weight, 0) / xs.length;
  const half = Math.floor(recent.length / 2);
  const d = toDisplay(avg(recent.slice(half)) - avg(recent.slice(0, half)), units);
  const now1 = fmt(Math.round(toDisplay(recent[recent.length - 1].weight, units) * 10) / 10);
  if (Math.abs(d) < 0.2) return `Body weight steady around ${now1} ${units} over the last 2 weeks.`;
  return `Body weight ${d < 0 ? 'down' : 'up'} about ${fmt(Math.round(Math.abs(d) * 10) / 10)} ${units} over the last 2 weeks (now ${now1} ${units}).`;
}

const nameOf = (byId: Map<string, Exercise>, id: string) => byId.get(id)?.name ?? id.replace(/_/g, ' ');

const lastOf = (id: string, finished: Workout[], before: number) =>
  [...finished]
    .filter((w) => w.finishedAt && w.startedAt < before)
    .sort((a, b) => b.startedAt - a.startedAt)
    .flatMap((w) => w.exercises.filter((e) => e.exerciseId === id && countedSets(e.sets).length))[0];

// ---------------------------------------------------------------------------------------------
// 1. Coach note after a workout

export function coachNotePrompt(w: Workout, finished: Workout[], byId: Map<string, Exercise>, units: Units, trend = ''): string {
  const before = finished.filter((x) => x.id !== w.id && x.startedAt < w.startedAt);
  const lines = w.exercises.map((e) => {
    const last = lastOf(e.exerciseId, before, w.startedAt);
    return `- ${exerciseLine(e, nameOf(byId, e.exerciseId), units)}${last ? `; last time ${setsText(last, units)}` : '; first time'}`;
  });
  const prs = workoutPrs(w, before.concat(w));
  const prev = previousLike(w, before);
  const cmp = prev ? compareWorkouts(w, prev) : null;
  const balance = muscleBalance(before.concat(w), byId, daysAgo(7, w.finishedAt ?? w.startedAt));
  return [
    'You are a strength coach. Write a short note for the lifter after the workout below.',
    'Two or three sentences, at most 50 words. Mention one or two specific numbers (a weight that went up, a lift that stalled or dropped, a muscle that is behind this week).',
    'If something went backwards or felt hard, say what to do next time in one short phrase. Be honest, not over the top.',
    RULES,
    '',
    `Workout: ${w.name}, ${Math.round(((w.finishedAt ?? w.startedAt) - w.startedAt) / 60000)} min. Weights in ${units}.`,
    ...lines,
    prs.length ? `New personal records: ${prs.map((p) => nameOf(byId, p.exerciseId)).join(', ')}.` : 'No new personal records.',
    cmp && cmp.volume.pct != null ? `Total volume vs the last ${prev!.name}: ${cmp.volume.pct >= 0 ? '+' : ''}${cmp.volume.pct}%.` : '',
    `Working sets per muscle in the last 7 days (10–20 is the usual target): ${balance.groups.map((g) => `${g.name} ${g.sets}`).join(', ')}.`,
    trend,
    w.notes ? `The lifter's own notes: "${clean(w.notes, 300)}"` : '',
  ].filter(Boolean).join('\n');
}

export const NOTE_SCHEMA = { type: 'OBJECT', properties: { note: { type: 'STRING' } }, required: ['note'] };

export function parseNote(text: string): string {
  return clean(parse<{ note?: string }>(text)?.note, 400);
}

// ---------------------------------------------------------------------------------------------
// 2. Smarter progressive overload: Gemini adjusts the rule-based weight using feel, missed reps and trends

export interface TuneRow {
  /** Index of the exercise in the workout. */
  index: number;
  name: string;
  repMin: number;
  repMax: number;
  /** Weight step, display units. */
  increment: number;
  rule: Suggestion;
  /** Top working weight last session, kg. */
  lastTop: number;
  /** Recent sessions, most recent first, as text. */
  sessions: string[];
  daysSince: number;
}

export function tunePrompt(rows: TuneRow[], units: Units, context: string[]): string {
  const list = rows.map((r, i) => [
    `${i + 1}. ${r.name} (target ${r.repMin}–${r.repMax} reps, weight step ${fmt(r.increment)} ${units}, last done ${r.daysSince} day${r.daysSince === 1 ? '' : 's'} ago)`,
    ...r.sessions.map((s, j) => `   ${j === 0 ? 'last time' : `${j + 1} sessions ago`}: ${s}`),
    `   rule says: ${r.rule.weight != null ? `${fmt(toDisplay(r.rule.weight, units))} ${units}` : 'bodyweight'} for ${r.rule.reps} reps`,
  ].join('\n'));
  return [
    'You are a strength coach setting today\'s working weight for each exercise below.',
    'The app\'s simple rule (double progression: go up a step after hitting the top of the rep range on every set, drop back after missing the bottom) gave a starting point.',
    'Adjust it only when the history gives a reason: how the last session felt (easy, ok, hard), reps falling off across sets, missed reps, a long break, a drop in body weight, or steady easy progress that can go faster.',
    'Stay within one weight step above the last top weight, never more than 15% below it, and use multiples of the weight step. Reps must be within the target range.',
    'For each exercise give the weight (in ' + units + '), the reps to aim for on each set, and a reason of at most 18 words that names what you based it on.',
    RULES,
    '',
    ...context.filter(Boolean),
    '',
    ...list,
  ].join('\n');
}

export const TUNE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    picks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { row: { type: 'INTEGER' }, weight: { type: 'NUMBER' }, reps: { type: 'INTEGER' }, reason: { type: 'STRING' } },
        required: ['row', 'weight', 'reps', 'reason'],
      },
    },
  },
  required: ['picks'],
};

/**
 * Checks one of Gemini's picks against safe limits. Returns the tuned target (kg) or null to keep the rule:
 * weight on the step grid, at most one step above the higher of the rule and last time, at most 15% under the lower.
 */
export function acceptTune(row: TuneRow, pick: { weight?: number; reps?: number; reason?: string }, units: Units): LoggedExercise['ai'] | null {
  if (row.rule.weight == null || !(row.lastTop > 0)) return null;
  if (typeof pick.weight !== 'number' || !Number.isFinite(pick.weight) || typeof pick.reps !== 'number') return null;
  const message = clean(pick.reason, 160);
  if (!message) return null;
  const step = row.increment;
  const rule = toDisplay(row.rule.weight, units);
  const last = toDisplay(row.lastTop, units);
  const w = roundTo(pick.weight, step);
  const hi = Math.max(rule, last + step) + 1e-6;
  const lo = Math.min(rule, last) * 0.85 - 1e-6;
  if (w > hi || w < lo || w <= 0) return null;
  const reps = clamp(Math.round(pick.reps), row.repMin, row.repMax);
  return { weight: fromDisplay(w, units), reps, message };
}

export function parseTune(text: string, rows: TuneRow[], units: Units): Map<number, NonNullable<LoggedExercise['ai']>> {
  const out = new Map<number, NonNullable<LoggedExercise['ai']>>();
  for (const p of parse<{ picks?: { row?: number; weight?: number; reps?: number; reason?: string }[] }>(text)?.picks ?? []) {
    const row = rows[(p.row ?? 0) - 1];
    if (!row || out.has(row.index)) continue;
    const ok = acceptTune(row, p, units);
    if (ok) out.set(row.index, ok);
  }
  return out;
}

/** The suggestion to show for an exercise: Gemini's tuned one when there is one, else the rule's. */
export function withAi(rule: Suggestion, le: LoggedExercise, lastTop: number | null): Suggestion & { ai?: boolean } {
  if (!le.ai) return rule;
  const kind = lastTop && le.ai.weight > lastTop + 1e-6 ? 'increase' : lastTop && le.ai.weight < lastTop - 1e-6 ? 'deload' : 'hold';
  return { kind, weight: le.ai.weight, reps: le.ai.reps, message: le.ai.message, ai: true };
}

// ---------------------------------------------------------------------------------------------
// 3. A workout from a plain-language request

export interface PlanPick extends PlannedExercise { why: string }
export interface PlanAnswer { name: string; exercises: PlanPick[] }

/** Exercises Gemini may choose from: the tagged generator list plus anything logged in the last 60 days, gear permitting. */
export function planCandidates(byId: Map<string, Exercise>, finished: Workout[], missing?: readonly string[], now = Date.now()): Exercise[] {
  const ids = new Set(MOVES.map((m) => m.id));
  for (const w of finished) if (w.startedAt >= now - 60 * DAY) for (const e of w.exercises) ids.add(e.exerciseId);
  return [...ids].map((id) => byId.get(id)).filter((e): e is Exercise => !!e && hasGear(e, missing));
}

const candidateLine = (e: Exercise) => {
  const t = mainTargets(e.id);
  return `- ${e.id}: ${e.name} (${e.equipment}; ${t.length ? t.join(', ').toLowerCase() : e.primaryMuscles.join(', ')})`;
};

export function planPrompt(request: string, candidates: Exercise[], context: string[]): string {
  return [
    'You are a strength coach. Build one gym workout for today that fits the lifter\'s request below.',
    'Respect every limit in the request: time available, soreness or injuries (avoid loading that area), equipment they can\'t use, muscles they want.',
    'Time it like the app does: each set takes about 45 seconds plus its rest, and each exercise about 90 seconds to set up. Order big compound lifts first. Train the parts of each muscle with different angles rather than repeating one movement.',
    'Use only exercise ids from the list. For each exercise give sets, a rep range, rest in seconds and a reason of at most 12 words.',
    'Also give the workout a short name of 2 to 4 words.',
    RULES,
    '',
    `Request: "${clean(request, 400)}"`,
    ...context.filter(Boolean),
    '',
    'Exercises you can use:',
    ...candidates.map(candidateLine),
  ].join('\n');
}

export const PLAN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    exercises: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' }, sets: { type: 'INTEGER' }, repMin: { type: 'INTEGER' }, repMax: { type: 'INTEGER' },
          rest: { type: 'INTEGER' }, why: { type: 'STRING' },
        },
        required: ['id', 'sets', 'repMin', 'repMax', 'rest', 'why'],
      },
    },
  },
  required: ['name', 'exercises'],
};

/** Keeps only listed exercises (no repeats) and sane numbers. Null when nothing usable came back. */
export function parsePlan(text: string, candidates: Exercise[]): PlanAnswer | null {
  const ok = new Set(candidates.map((c) => c.id));
  const raw = parse<{ name?: string; exercises?: { id?: string; sets?: number; repMin?: number; repMax?: number; rest?: number; why?: string }[] }>(text);
  if (!raw) return null;
  const seen = new Set<string>();
  const exercises: PlanPick[] = [];
  for (const e of raw.exercises ?? []) {
    if (!e.id || !ok.has(e.id) || seen.has(e.id)) continue;
    seen.add(e.id);
    const repMin = clamp(Math.round(e.repMin ?? 8), 1, 30);
    const repMax = clamp(Math.round(e.repMax ?? repMin), repMin, 30);
    exercises.push({
      exerciseId: e.id,
      sets: clamp(Math.round(e.sets ?? 3), 1, 6),
      repMin, repMax,
      rest: clamp(Math.round(e.rest ?? 90), 30, 300),
      why: clean(e.why, 100),
    });
    if (exercises.length >= 12) break;
  }
  if (!exercises.length) return null;
  return { name: clean(raw.name, 40) || 'Custom workout', exercises };
}

// ---------------------------------------------------------------------------------------------
// 4. Swaps with a reason

export interface SwapPick { id: string; why: string }

export function swapPrompt(current: Exercise, candidates: Exercise[], today: string[], lastTime: string): string {
  return [
    `The lifter wants to swap ${current.name} (${current.equipment}; trains ${(mainTargets(current.id).join(', ') || current.primaryMuscles.join(', ')).toLowerCase()}), usually because the equipment is busy.`,
    'Pick the 3 best replacements from the list, best first. Prefer ones that train the same part of the muscle with a similar movement and rep range,',
    'that use different equipment from the busy one, and that don\'t repeat what is already in today\'s workout.',
    'For each, give a reason of at most 14 words saying why it fits (which part it trains, how it compares).',
    RULES,
    '',
    lastTime ? `Last time on ${current.name}: ${lastTime}.` : '',
    today.length ? `Already in today's workout: ${today.join(', ')}.` : '',
    '',
    'Options:',
    ...candidates.map(candidateLine),
  ].filter((l, i, a) => l || a[i - 1]).join('\n');
}

export const SWAP_SCHEMA = {
  type: 'OBJECT',
  properties: {
    picks: { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: { type: 'STRING' }, why: { type: 'STRING' } }, required: ['id', 'why'] } },
  },
  required: ['picks'],
};

export function parseSwap(text: string, candidates: Exercise[]): SwapPick[] {
  const ok = new Set(candidates.map((c) => c.id));
  const out: SwapPick[] = [];
  for (const p of parse<{ picks?: { id?: string; why?: string }[] }>(text)?.picks ?? []) {
    if (!p.id || !ok.has(p.id) || out.some((o) => o.id === p.id)) continue;
    out.push({ id: p.id, why: clean(p.why, 120) });
    if (out.length >= 3) break;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// 5. Weekly check-in

export interface CheckIn {
  headline: string;
  points: string[];
  action: 'none' | 'deload' | 'focus';
  /** Muscle group to focus on when action is 'focus'. */
  focus?: string;
}

/** A plain-text summary of the last 6 weeks for the check-in prompt. */
export function checkInFacts(
  finished: Workout[],
  byId: Map<string, Exercise>,
  settings: Pick<Settings, 'units' | 'lastDeloadAt' | 'deloadUntil'>,
  weights: Pick<BodyWeight, 'date' | 'weight'>[],
  now = Date.now(),
): string[] {
  const { units } = settings;
  const weeks = Array.from({ length: 6 }, (_, i) => weekStart(now - (5 - i) * 7 * DAY));
  const recent = finished.filter((w) => w.finishedAt && w.startedAt >= weeks[0]);
  const perWeek = weeks.map((ws) => recent.filter((w) => weekStart(w.startedAt) === ws).length);

  // Most-trained lifts and their best estimated 1RM per week, to spot plateaus.
  const counts = new Map<string, number>();
  for (const w of recent) for (const e of w.exercises) if (e.mode !== 'time' && countedSets(e.sets).some((s) => s.weight > 0)) counts.set(e.exerciseId, (counts.get(e.exerciseId) ?? 0) + 1);
  const top = [...counts].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id]) => id);
  const lifts = top.map((id) => {
    const best = weeks.map((ws) => {
      let b = 0;
      for (const w of recent) if (weekStart(w.startedAt) === ws) for (const e of w.exercises) if (e.exerciseId === id) for (const s of countedSets(e.sets)) b = Math.max(b, e1rm(s.weight, s.reps));
      return b ? fmt(Math.round(toDisplay(b, units))) : '–';
    });
    const hard = recent.flatMap((w) => w.exercises.filter((e) => e.exerciseId === id && e.feel === 'hard')).length;
    return `- ${nameOf(byId, id)}: ${best.join(' → ')}${hard ? ` (felt hard ${hard}×)` : ''}`;
  });

  const thisWeek = muscleBalance(finished, byId, now - 7 * DAY);
  const before = muscleBalance(finished.filter((w) => w.startedAt < now - 7 * DAY), byId, now - 28 * DAY);
  const groups = thisWeek.groups.map((g) => {
    const avg = Math.round((before.groups.find((x) => x.name === g.name)?.sets ?? 0) / 3);
    return `${g.name} ${g.sets} (usual ${avg})`;
  });
  const sinceDeload = trainingWeeks(finished, settings.lastDeloadAt ?? 0, now);
  return [
    `Workouts per week, oldest to newest (last 6 weeks): ${perWeek.join(', ')}.`,
    `Weeks of steady training since the last deload: ${sinceDeload}${settings.lastDeloadAt ? '' : ' (never deloaded)'}.${deloadActive(settings, now) ? ' A deload week is running now.' : ''}`,
    lifts.length ? `Best estimated 1RM per week (${units}), oldest to newest:` : 'Not enough repeated lifts to spot trends yet.',
    ...lifts,
    `Working sets per muscle in the last 7 days, with the weekly average of the 3 weeks before (10–20 is the usual target): ${groups.join(', ')}.`,
    thisWeek.tip ?? '',
    weightTrend(weights, units, now),
  ].filter(Boolean);
}

export function checkInPrompt(facts: string[]): string {
  return [
    'You are a strength coach doing a weekly check-in with a lifter, based on the training log summary below.',
    'Spot plateaus (a lift flat or dropping for 3+ weeks), muscles that are neglected compared with the rest, and signs of fatigue (many hard sessions, strength dropping across lifts, 6+ weeks without a lighter week).',
    'Give a one-sentence headline, then 2 to 4 short points (each at most 22 words, with specific lifts or numbers).',
    'Then pick one action: "deload" if a lighter week would help now, "focus" with the one muscle group to prioritise this week, or "none" if things are on track.',
    RULES,
    '',
    ...facts,
  ].join('\n');
}

export const CHECKIN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    headline: { type: 'STRING' },
    points: { type: 'ARRAY', items: { type: 'STRING' } },
    action: { type: 'STRING', enum: ['none', 'deload', 'focus'] },
    focus: { type: 'STRING' },
  },
  required: ['headline', 'points', 'action'],
};

export function parseCheckIn(text: string): CheckIn | null {
  const raw = parse<{ headline?: string; points?: unknown[]; action?: string; focus?: string }>(text);
  const headline = clean(raw?.headline, 200);
  if (!raw || !headline) return null;
  const points = (raw.points ?? []).map((p) => clean(p, 200)).filter(Boolean).slice(0, 4);
  const action = raw.action === 'deload' || raw.action === 'focus' ? raw.action : 'none';
  const focus = clean(raw.focus, 30);
  return { headline, points, action: action === 'focus' && !focus ? 'none' : action, ...(action === 'focus' && focus ? { focus } : {}) };
}

// ---------------------------------------------------------------------------------------------
// Calling Gemini

export const coachOn = () => !!geminiKey();

/** Asks Gemini and parses the answer; throws a readable message on failure. */
export async function ask<T>(prompt: string, schema: object, read: (text: string) => T, timeoutMs = 20000): Promise<T> {
  const key = geminiKey();
  if (!key) throw new Error('add your free Gemini key in Settings > AI coach');
  const text = await askGemini(key, [{ text: prompt }], schema, { timeoutMs });
  return read(text);
}
