import type { Day, Exercise, PlannedExercise, Program, Workout } from '../types';
import { HARD_SETS, loadSince, RECOVERY_HOURS } from './recovery';
import { groupCredit, MOVE_BY_ID, MOVES, TARGETS, type Equipment, type Group, type Move, type Target } from './targets';

export type { Equipment } from './targets';
export type Goal = 'strength' | 'muscle' | 'general';
export type Experience = 'beginner' | 'intermediate';

export interface GeneratorInput {
  goal: Goal;
  days: number; // 2–6
  experience: Experience;
  equipment: Equipment;
  minutes: number; // how long each session is, e.g. 30–120
}

/** Every exercise id the generator can choose, for checking against the library. */
export const GENERATOR_EXERCISES = MOVES.map((mv) => mv.id);

const ALLOWED: Record<Equipment, Equipment[]> = {
  gym: ['gym', 'dumbbells', 'bodyweight'],
  dumbbells: ['dumbbells', 'bodyweight'],
  bodyweight: ['bodyweight'],
};

/**
 * What a kind of day trains: how much it cares about each muscle group (1 = this day's job, absent =
 * not today), and how strongly it spreads across groups. A full-body day wants one exercise per big
 * muscle; a push day has room to hit the chest from two angles.
 */
interface Focus { groups: Partial<Record<Group, number>>; spread: number }
const F = {
  full: { spread: 2, groups: { chest: 1, back: 1, quads: 1, hams: 0.9, glutes: 0.8, delts: 0.7, rearDelts: 0.5, biceps: 0.5, triceps: 0.5, calves: 0.4, core: 0.5 } },
  upper: { spread: 1, groups: { chest: 1, back: 1, delts: 1, rearDelts: 0.8, biceps: 0.75, triceps: 0.75, traps: 0.3 } },
  lower: { spread: 0.4, groups: { quads: 1, hams: 1, glutes: 1, calves: 1, core: 0.8, lowerBack: 0.4 } },
  push: { spread: 0.35, groups: { chest: 1, delts: 1, triceps: 1 } },
  pull: { spread: 0.35, groups: { back: 1, rearDelts: 1, biceps: 1, traps: 0.5, lowerBack: 0.3 } },
  legs: { spread: 0.4, groups: { quads: 1, hams: 1, glutes: 1, calves: 1, core: 0.8, lowerBack: 0.4 } },
} satisfies Record<string, Focus>;

function splitFor(days: number, experience: Experience): { name: string; days: [string, Focus][] } {
  switch (Math.max(2, Math.min(6, days))) {
    case 2:
      return { name: 'Full Body', days: [['Full Body A', F.full], ['Full Body B', F.full]] };
    case 3:
      return experience === 'beginner'
        ? { name: 'Full Body', days: [['Full Body A', F.full], ['Full Body B', F.full], ['Full Body C', F.full]] }
        : { name: 'Push / Pull / Legs', days: [['Push', F.push], ['Pull', F.pull], ['Legs', F.legs]] };
    case 4:
      return { name: 'Upper / Lower', days: [['Upper A', F.upper], ['Lower A', F.lower], ['Upper B', F.upper], ['Lower B', F.lower]] };
    case 5:
      return { name: 'PPL + Upper / Lower', days: [['Push', F.push], ['Pull', F.pull], ['Legs', F.legs], ['Upper', F.upper], ['Lower', F.lower]] };
    default:
      return { name: 'Push / Pull / Legs ×2', days: [['Push A', F.push], ['Pull A', F.pull], ['Legs A', F.legs], ['Push B', F.push], ['Pull B', F.pull], ['Legs B', F.legs]] };
  }
}

/** Session lengths the generator offers, in minutes. */
export const SESSION_MINUTES = [30, 45, 60, 75, 90, 120];

/**
 * Rough timing for planning a session: about 45 s of work per set, the planned rest between sets,
 * and a minute and a half per exercise to set up, load and move to the next one.
 */
const WORK_SECONDS = 45;
const SETUP_SECONDS = 90;
/** Main exercises a day always gets, however short the session, and the most it gets however long. */
const MIN_MAIN = 2;
const MAX_MAIN = 10;

export function exerciseSeconds(e: Pick<PlannedExercise, 'sets' | 'rest' | 'mode' | 'repMin' | 'repMax'>): number {
  const work = e.mode === 'time' ? (e.repMin + e.repMax) / 2 : WORK_SECONDS;
  return SETUP_SECONDS + e.sets * work + Math.max(0, e.sets - 1) * e.rest;
}

/** About how many minutes a day of the program takes, rests included. */
export function estimateMinutes(day: Pick<Day, 'exercises'>): number {
  return Math.round(day.exercises.reduce((n, e) => n + exerciseSeconds(e), 0) / 60);
}

/**
 * Every generated day ends with the same core finisher: two ab exercises (different movements, say a
 * crunch and a leg raise) and one lower back exercise. They rotate across the week for variety.
 */
const AB_PATTERNS = new Set(['crunch', 'leg-raise', 'anti-ext', 'anti-rot', 'rotation']);
const OBLIQUE_PATTERNS = new Set(['anti-rot', 'rotation']);
const LOWER_BACK_PATTERNS = new Set(['back-ext']);
export const isFinisherMove = (mv: Move) => AB_PATTERNS.has(mv.pattern) || LOWER_BACK_PATTERNS.has(mv.pattern);

function finisherPrescription(mv: Move, minutes: number): PlannedExercise {
  const sets = minutes >= 60 ? 3 : 2;
  if (mv.id === 'Plank' || mv.id === 'Side_Bridge') return { exerciseId: mv.id, sets, repMin: 30, repMax: 60, rest: 45, mode: 'time' };
  return LOWER_BACK_PATTERNS.has(mv.pattern)
    ? { exerciseId: mv.id, sets: 2, repMin: 12, repMax: 15, rest: 60 }
    : { exerciseId: mv.id, sets, repMin: 12, repMax: 20, rest: 45 };
}

function pickFinisher(pool: Move[], uses: Map<string, number>, patternUses: Map<string, number>): Move[] {
  const fresh = (mv: Move) => mv.quality / (1 + uses.get(mv.id)!) / (1 + 0.5 * patternUses.get(mv.pattern)!);
  const best = (cands: Move[]) => cands.reduce<Move | undefined>((b, mv) => (!b || fresh(mv) > fresh(b) ? mv : b), undefined);
  for (const mv of pool) { if (!uses.has(mv.id)) uses.set(mv.id, 0); if (!patternUses.has(mv.pattern)) patternUses.set(mv.pattern, 0); }
  const abs = pool.filter((mv) => AB_PATTERNS.has(mv.pattern));
  const first = best(abs);
  // The second ab exercise is a different kind of movement, so the two cover different parts of the core.
  // Two oblique movements would leave the front of the abs out, so at most one of them.
  const oblique = (mv: Move) => OBLIQUE_PATTERNS.has(mv.pattern);
  const second = first && (best(abs.filter((mv) => mv.pattern !== first.pattern && !(oblique(mv) && oblique(first))))
    ?? best(abs.filter((mv) => mv !== first)));
  const back = best(pool.filter((mv) => LOWER_BACK_PATTERNS.has(mv.pattern)));
  const out = [first, second, back].filter((mv): mv is Move => !!mv);
  for (const mv of out) { uses.set(mv.id, uses.get(mv.id)! + 1); patternUses.set(mv.pattern, patternUses.get(mv.pattern)! + 1); }
  return out;
}

function prescription(goal: Goal, experience: Experience, compound: boolean) {
  const base = {
    strength: compound ? { sets: 4, repMin: 4, repMax: 6, rest: 180 } : { sets: 3, repMin: 8, repMax: 12, rest: 90 },
    muscle: compound ? { sets: 3, repMin: 6, repMax: 10, rest: 120 } : { sets: 3, repMin: 10, repMax: 15, rest: 75 },
    general: compound ? { sets: 3, repMin: 8, repMax: 12, rest: 90 } : { sets: 2, repMin: 12, repMax: 15, rest: 60 },
  }[goal];
  // Beginners recover better from slightly less volume on the heaviest work.
  return experience === 'beginner' && base.sets >= 4 ? { ...base, sets: base.sets - 1 } : base;
}

type Tally = Partial<Record<Target | Group, number>>;
const add = (tally: Tally, mv: Move) => {
  const groups = new Map<Group, number>();
  for (const [t, w] of Object.entries(mv.hits) as [Target, number][]) {
    tally[t] = (tally[t] ?? 0) + w;
    const g = TARGETS[t].group;
    groups.set(g, Math.max(groups.get(g) ?? 0, w));
  }
  for (const [g, w] of groups) tally[g] = (tally[g] ?? 0) + w;
};

/**
 * How much picking this exercise now would add. Each part of a muscle the day is meant to train is
 * worth its priority, and that worth falls quickly once it's been trained today and more slowly once
 * it's been trained earlier in the week. So the second chest exercise of a day goes after the part the
 * first one missed (incline after flat), and Upper B covers what Upper A didn't.
 */
function score(mv: Move, focus: Focus, today: Tally, week: Tally, patternsToday: Set<string>, usedThisWeek: Set<string>, goal: Goal): number {
  let value = 0;
  for (const [t, w] of Object.entries(mv.hits) as [Target, number][]) {
    const { group, priority } = TARGETS[t];
    const relevance = focus.groups[group] ?? 0;
    if (!relevance) continue;
    value += w * priority * relevance
      / (1 + 2 * (today[t] ?? 0))
      / (1 + focus.spread * (today[group] ?? 0))
      / (1 + 0.25 * (week[t] ?? 0));
  }
  let s = value * mv.quality;
  if (patternsToday.has(mv.pattern)) s *= 0.4;
  if (usedThisWeek.has(mv.id)) s *= 0.75;
  if (goal === 'strength' && mv.compound) s *= 1.15;
  return s;
}

/**
 * Picks a day's main exercises one at a time, each the one that adds the most for what the day trains,
 * until the session's time runs out (always at least MIN_MAIN). `bonus` scales an exercise's score.
 */
function fillMain(o: {
  pool: Move[]; focus: Focus; seconds: number; week: Tally; usedThisWeek: Set<string>; goal: Goal;
  plan: (mv: Move) => PlannedExercise; fitsWeek: (mv: Move) => boolean; onPick?: (mv: Move) => void; bonus?: (mv: Move) => number;
}): Move[] {
  let left = o.seconds;
  const today: Tally = {};
  const patterns = new Set<string>();
  const picked: Move[] = [];
  while (picked.length < MAX_MAIN) {
    let best: Move | undefined;
    let bestScore = 0;
    for (const mv of o.pool) {
      if (picked.includes(mv)) continue;
      if (picked.length >= MIN_MAIN && (exerciseSeconds(o.plan(mv)) > left || !o.fitsWeek(mv))) continue;
      const s = score(mv, o.focus, today, o.week, patterns, o.usedThisWeek, o.goal) * (o.bonus?.(mv) ?? 1);
      if (s > bestScore) { best = mv; bestScore = s; }
    }
    if (!best) break;
    left -= exerciseSeconds(o.plan(best));
    o.onPick?.(best);
    picked.push(best);
    add(today, best);
    patterns.add(best.pattern);
  }
  return picked;
}

/**
 * Builds a program from quiz answers by covering every part of each muscle the split trains: upper,
 * mid and lower chest, all three delt heads, lats and mid back, both biceps and triceps heads, and so on.
 * Pure and deterministic, so the same answers give the same routine.
 */
export function generateProgram(input: GeneratorInput, id: string, now = Date.now(), available: (exerciseId: string) => boolean = () => true): Program {
  const split = splitFor(input.days, input.experience);
  const allowed = new Set(ALLOWED[input.equipment]);
  const budget = input.minutes * 60;
  const usable = MOVES.filter((mv) => allowed.has(mv.eq) && available(mv.id));
  const pool = usable.filter((mv) => !isFinisherMove(mv));
  const finisherPool = usable.filter(isFinisherMove);
  const finisherUses = new Map<string, number>();
  const finisherPatterns = new Map<string, number>();
  const week: Tally = {};
  const usedThisWeek = new Set<string>();
  // Weekly sets per muscle if every exercise so far were cut to its minimum. A long session only adds
  // exercises while that stays within the useful weekly range; past it, extra time is junk volume.
  const floorSets = new Map<Group, number>();
  const fitsWeek = (mv: Move) => [...groupCredit(mv)].every(([g, c]) => (floorSets.get(g) ?? 0) + c * MIN_SETS <= WEEKLY_SETS.high);
  const plan = (mv: Move): PlannedExercise => ({ exerciseId: mv.id, ...prescription(input.goal, input.experience, mv.compound) });

  const finishers: PlannedExercise[][] = [];
  const days: Day[] = split.days.map(([name, focus], di) => {
    const finisher = pickFinisher(finisherPool, finisherUses, finisherPatterns).map((mv) => finisherPrescription(mv, input.minutes));
    finishers.push(finisher);
    // The core finisher's time comes off the top; main exercises fill the rest of the session.
    const left = budget - finisher.reduce((n, e) => n + exerciseSeconds(e), 0);
    const picked = fillMain({
      pool, focus, seconds: left, week, usedThisWeek, goal: input.goal, plan, fitsWeek,
      onPick: (mv) => { for (const [g, c] of groupCredit(mv)) floorSets.set(g, (floorSets.get(g) ?? 0) + c * MIN_SETS); },
    });
    for (const mv of picked) { add(week, mv); usedThisWeek.add(mv.id); }
    // Heavy compound lifts first while fresh, then isolation work, otherwise in the order picked.
    const ordered = [...picked.filter((mv) => mv.compound), ...picked.filter((mv) => !mv.compound)];
    return { id: `${id}-d${di}`, name, exercises: ordered.map(plan) };
  });

  balanceWeeklySets(days, (di) => budget - finishers[di].reduce((n, e) => n + exerciseSeconds(e), 0));
  days.forEach((d, di) => d.exercises.push(...finishers[di]));

  const goalText = { strength: 'strength', muscle: 'muscle', general: 'general fitness' }[input.goal];
  const eqText = { gym: 'a full gym', dumbbells: 'dumbbells', bodyweight: 'bodyweight only' }[input.equipment];
  return {
    id,
    name: `My ${split.name}`,
    description: `Built for ${goalText}: ${input.days} days a week, about ${input.minutes} min, ${eqText}, ${input.experience}.`,
    days,
    createdAt: now,
  };
}

/**
 * Which muscle parts a week of this program trains (a solid share of at least one exercise,
 * counting the share from compound lifts), and which important ones it leaves out.
 */
export function weekCoverage(program: Pick<Program, 'days'>): { covered: Target[]; missing: Target[] } {
  const week: Tally = {};
  for (const d of program.days) for (const e of d.exercises) {
    const mv = MOVE_BY_ID.get(e.exerciseId);
    if (mv) add(week, mv);
  }
  const all = Object.keys(TARGETS) as Target[];
  const done = (t: Target) => (week[t] ?? 0) >= 0.6;
  return {
    covered: all.filter(done),
    // Small extras (traps, side glutes, front delts that every press already trains) aren't flagged.
    missing: all.filter((t) => !done(t) && TARGETS[t].priority >= 0.5),
  };
}

/** Weekly working sets aimed for per muscle: the usual range for growth (as on the Muscle balance page). */
export const WEEKLY_SETS = { low: 10, high: 20 };
const MAX_SETS = 5;
const SMALL = new Set<Group>(['biceps', 'triceps', 'rearDelts', 'calves', 'core', 'lowerBack', 'traps']);
const MIN_SETS = 2;

/** Weekly sets per muscle group, counting a full set for a main target and half for a clear secondary one. */
export function weeklySets(program: Pick<Program, 'days'>): Map<Group, number> {
  const out = new Map<Group, number>();
  for (const d of program.days) for (const e of d.exercises) {
    const mv = MOVE_BY_ID.get(e.exerciseId);
    if (!mv) continue;
    for (const [g, c] of groupCredit(mv)) out.set(g, (out.get(g) ?? 0) + c * e.sets);
  }
  return out;
}

/**
 * Nudges set counts so every muscle the week trains as a main target gets 10–20 sets, within each
 * session's time. Adds sets where a muscle is short (isolation work first, it's cheaper to recover
 * from), then trims where one is over, never pushing another muscle out of range.
 */
function balanceWeeklySets(days: Day[], secondsFor: (dayIndex: number) => number) {
  const entries = days.flatMap((d, di) => d.exercises.map((e) => ({ day: d, di, e, mv: MOVE_BY_ID.get(e.exerciseId)! }))).filter((x) => x.mv);
  const daySeconds = (d: Day) => d.exercises.reduce((n, e) => n + exerciseSeconds(e), 0);
  const trained = new Set(entries.flatMap(({ mv }) => [...groupCredit(mv)].filter(([, c]) => c === 1).map(([g]) => g)));
  const sets = () => weeklySets({ days });

  for (let guard = 0; guard < 200; guard++) {
    const now = sets();
    // Big muscles first when time is tight, then whichever is furthest behind.
    const short = [...trained].filter((g) => (now.get(g) ?? 0) < WEEKLY_SETS.low)
      .sort((a, b) => Number(SMALL.has(a)) - Number(SMALL.has(b)) || (now.get(a) ?? 0) - (now.get(b) ?? 0));
    let added = false;
    for (const g of short) {
      const pick = entries
        .filter(({ day, di, e, mv }) => groupCredit(mv).get(g) === 1 && e.sets < MAX_SETS && daySeconds(day) + WORK_SECONDS + e.rest <= secondsFor(di)
          && [...groupCredit(mv)].every(([og, c]) => (now.get(og) ?? 0) + c <= WEEKLY_SETS.high))
        .sort((a, b) => Number(a.mv.compound) - Number(b.mv.compound) || a.e.sets - b.e.sets)[0];
      if (pick) { pick.e.sets++; added = true; break; }
    }
    if (!added) break;
  }
  for (let guard = 0; guard < 200; guard++) {
    const now = sets();
    const over = [...now].filter(([, n]) => n > WEEKLY_SETS.high).sort((a, b) => b[1] - a[1]).map(([g]) => g);
    let removed = false;
    for (const g of over) {
      const cuttable = entries.filter(({ e, mv }) => (groupCredit(mv).get(g) ?? 0) > 0 && e.sets > MIN_SETS);
      // Rather a set that leaves every other muscle in range; failing that, staying under 20 wins.
      const pick = cuttable
        .filter(({ mv }) => [...groupCredit(mv)].every(([og, c]) => og === g || !trained.has(og) || (now.get(og) ?? 0) - c >= WEEKLY_SETS.low))
        .sort((a, b) => b.e.sets - a.e.sets)[0]
        ?? cuttable.sort((a, b) => Number(a.mv.compound) - Number(b.mv.compound) || b.e.sets - a.e.sets)[0];
      if (pick) { pick.e.sets--; removed = true; break; }
    }
    if (!removed) break;
  }
  // A short session with long rests can still run over: take sets off the biggest exercises until it fits.
  days.forEach((d, di) => {
    while (daySeconds(d) > secondsFor(di)) {
      const pick = [...d.exercises].filter((e) => e.sets > MIN_SETS).sort((a, b) => b.sets - a.sets || b.rest - a.rest)[0];
      if (!pick) break;
      pick.sets--;
    }
  });
}

/* ---------- Today's workout, built from what you've logged ---------- */

export type TodayInput = Omit<GeneratorInput, 'days'>;

export interface TodayPlan {
  day: Day;
  /** What kind of session it picked, e.g. "Pull". */
  kind: string;
  /** Main muscles left out because they were trained hard in the last 2 days, most-worked first. */
  resting: Group[];
  /** Main muscles furthest behind on this week's sets that today works on. */
  behind: Group[];
  /** True when nearly everything is still recovering, so a rest day may be the better call. */
  restDay: boolean;
}

const TODAY_KINDS: [string, Focus][] = [
  ['Full Body', F.full], ['Upper Body', F.upper], ['Lower Body', F.lower], ['Push', F.push], ['Pull', F.pull],
];
const DAY = 864e5;

/**
 * Builds one workout for today from the workout history instead of a fixed list:
 *  - muscles with 6+ hard sets in the last 48 hours rest; ones with a few sets count for less
 *  - muscles with the fewest sets over the last 7 days come first, and ones already at 20 are left alone
 *  - areas the week hasn't trained yet (upper chest, biceps long head, …) win over ones it has
 *  - exercises you've done before are preferred, so the weights come from your own numbers, with the
 *    ones done in the last few days swapped for a different angle
 * It still fills the session to its length and ends with the core finisher.
 */
export function generateToday(
  input: TodayInput,
  finished: Workout[],
  byId: Map<string, Exercise>,
  now = Date.now(),
  available: (exerciseId: string) => boolean = () => true,
): TodayPlan {
  const recent = loadSince(finished, byId, now, RECOVERY_HOURS);
  const weekSets = loadSince(finished, byId, now, 7 * 24);
  const readiness = (g: Group) => {
    const n = recent.get(g) ?? 0;
    return n >= HARD_SETS ? 0 : n >= 3 ? 0.4 : 1;
  };
  const need = (g: Group) => {
    const n = weekSets.get(g) ?? 0;
    return n >= WEEKLY_SETS.high ? 0 : 0.35 + 0.65 * Math.max(0, 1 - n / WEEKLY_SETS.low);
  };
  const want = (g: Group) => readiness(g) * need(g);
  // Abs and lower back get the core finisher every day, so they don't decide the kind of session.
  const mainOf = (f: Focus) => (Object.entries(f.groups) as [Group, number][]).filter(([g, r]) => r >= 0.75 && g !== 'core' && g !== 'lowerBack').map(([g]) => g);

  // The kind of session whose main muscles are most rested and most behind for the week.
  const rated = TODAY_KINDS.map(([name, focus]) => {
    const main = mainOf(focus);
    return { name, focus, value: main.reduce((n, g) => n + want(g), 0) / main.length };
  });
  const best = rated.reduce((b, r) => (r.value > b.value + 1e-9 ? r : b));
  const focus: Focus = {
    spread: best.focus.spread,
    groups: Object.fromEntries((Object.entries(best.focus.groups) as [Group, number][])
      .map(([g, r]) => [g, r * want(g)]).filter(([, r]) => (r as number) > 0)),
  };

  // What the last 7 days already trained, down to the part of the muscle.
  const week: Tally = {};
  const usedThisWeek = new Set<string>();
  const usedLately = new Set<string>();
  const known = new Set<string>();
  const finisherUses = new Map<string, number>();
  const finisherPatterns = new Map<string, number>();
  for (const w of finished) {
    if (!w.finishedAt || w.startedAt > now) continue;
    for (const e of w.exercises) {
      if (!e.sets.some((x) => x.done && x.type !== 'warmup')) continue;
      known.add(e.exerciseId);
      if (now - w.startedAt > 7 * DAY) continue;
      const mv = MOVE_BY_ID.get(e.exerciseId);
      if (!mv) continue;
      add(week, mv);
      usedThisWeek.add(mv.id);
      if (now - w.startedAt < 3 * DAY) usedLately.add(mv.id);
      if (isFinisherMove(mv)) {
        finisherUses.set(mv.id, (finisherUses.get(mv.id) ?? 0) + 1);
        finisherPatterns.set(mv.pattern, (finisherPatterns.get(mv.pattern) ?? 0) + 1);
      }
    }
  }

  const allowed = new Set(ALLOWED[input.equipment]);
  const usable = MOVES.filter((mv) => allowed.has(mv.eq) && available(mv.id));
  const pool = usable.filter((mv) => !isFinisherMove(mv));
  const finisher = pickFinisher(usable.filter(isFinisherMove), finisherUses, finisherPatterns).map((mv) => finisherPrescription(mv, input.minutes));
  const plan = (mv: Move): PlannedExercise => ({ exerciseId: mv.id, ...prescription(input.goal, input.experience, mv.compound) });
  const seconds = input.minutes * 60 - finisher.reduce((n, e) => n + exerciseSeconds(e), 0);
  // Sets each muscle would have this week if today's exercises got their minimum.
  const floorSets = new Map(weekSets);
  const fitsWeek = (mv: Move) => [...groupCredit(mv)].every(([g, c]) => c < 1 || (floorSets.get(g) ?? 0) + c * MIN_SETS <= WEEKLY_SETS.high);
  const picked = fillMain({
    pool, focus, seconds, week, usedThisWeek, goal: input.goal, plan, fitsWeek,
    onPick: (mv) => { for (const [g, c] of groupCredit(mv)) floorSets.set(g, (floorSets.get(g) ?? 0) + c * MIN_SETS); },
    // Lifts you know come with your own weights; ones from the last few days give way to another angle.
    bonus: (mv) => (known.has(mv.id) ? 1.3 : 1) * (usedLately.has(mv.id) ? 0.6 : 1),
  });
  const main = [...picked.filter((mv) => mv.compound), ...picked.filter((mv) => !mv.compound)].map(plan);

  // Spare time goes to extra sets for muscles still short of 10 for the week, smaller exercises first.
  const total = () => [...main, ...finisher].reduce((n, e) => n + exerciseSeconds(e), 0);
  const setsNow = new Map(weekSets);
  for (const e of main) for (const [g, c] of groupCredit(MOVE_BY_ID.get(e.exerciseId)!)) setsNow.set(g, (setsNow.get(g) ?? 0) + c * e.sets);
  for (let guard = 0; guard < 40; guard++) {
    const pick = main
      .filter((e) => e.sets < 4 && total() + WORK_SECONDS + e.rest <= input.minutes * 60)
      .filter((e) => [...groupCredit(MOVE_BY_ID.get(e.exerciseId)!)].some(([g, c]) => c === 1 && (setsNow.get(g) ?? 0) < WEEKLY_SETS.low)
        && [...groupCredit(MOVE_BY_ID.get(e.exerciseId)!)].every(([g, c]) => (setsNow.get(g) ?? 0) + c <= WEEKLY_SETS.high))
      .sort((a, b) => a.sets - b.sets)[0];
    if (!pick) break;
    pick.sets++;
    for (const [g, c] of groupCredit(MOVE_BY_ID.get(pick.exerciseId)!)) setsNow.set(g, (setsNow.get(g) ?? 0) + c);
  }

  const kindMain = mainOf(best.focus);
  const trainedToday = new Set(picked.flatMap((mv) => [...groupCredit(mv)].filter(([, c]) => c === 1).map(([g]) => g)));
  const everyMain = [...new Set(TODAY_KINDS.flatMap(([, f]) => mainOf(f)))];
  return {
    day: { id: `today-${now}`, name: best.name, exercises: [...main, ...finisher] },
    kind: best.name,
    resting: everyMain.filter((g) => readiness(g) === 0).sort((a, b) => recent.get(b)! - recent.get(a)!),
    behind: kindMain.filter((g) => trainedToday.has(g) && (weekSets.get(g) ?? 0) < WEEKLY_SETS.low / 2)
      .sort((a, b) => (weekSets.get(a) ?? 0) - (weekSets.get(b) ?? 0)),
    restDay: best.value < 0.2,
  };
}

/* ---------- Fitting any planned day to the user's session size ---------- */

/** How big a workout should be: as the split plans it, a number of exercises, or a length in minutes. */
export type SessionSize = { kind: 'plan' } | { kind: 'exercises'; n: number } | { kind: 'minutes'; n: number };

export interface FitOptions {
  size: SessionSize;
  /** End with two ab exercises and one lower back exercise, adding them if the day doesn't have them. */
  finisher: boolean;
  available?: (exerciseId: string) => boolean;
  /** Finished workouts, so the finisher rotates its exercises from one session to the next. */
  finished?: Workout[];
}

/** Planned exercises added to fill a session, so the workout can say why they're there. */
export type FittedExercise = PlannedExercise & { added?: boolean };

const words = (id: string) => new Set(id.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2 && w !== 'with'));
/**
 * The generator's entry for an exercise, or for a near-identical one when the split uses a library
 * exercise it doesn't know (Cable Rope Overhead Triceps Extension ~ Triceps Overhead Extension with Rope),
 * so a filled-up day doesn't add the same movement twice.
 */
function moveLike(id: string): Move | undefined {
  const known = MOVE_BY_ID.get(id);
  if (known) return known;
  const a = words(id);
  let best: Move | undefined;
  let bestSim = 0.6;
  for (const mv of MOVES) {
    const b = words(mv.id);
    const shared = [...a].filter((w) => b.has(w)).length;
    const sim = shared / (a.size + b.size - shared);
    if (sim >= bestSim) { best = mv; bestSim = sim; }
  }
  return best;
}

/** The trailing ab / lower back exercises of a day, which count as its core finisher. */
function finisherStart(exercises: PlannedExercise[]): number {
  let i = exercises.length;
  while (i > 0) {
    const mv = MOVE_BY_ID.get(exercises[i - 1].exerciseId);
    if (!mv || !isFinisherMove(mv)) break;
    i--;
  }
  return i;
}

/**
 * Trims or fills a day of any split to the session size the user picked, and adds the core finisher
 * when asked. Extra exercises go after the parts of the day's muscles its exercises leave out (a push
 * day with flat bench gets incline, not more flat). Trimming drops from the end, where accessories sit.
 * Deterministic, so Home's preview matches what starts.
 */
export function fitDay(day: Day, o: FitOptions): Omit<Day, 'exercises'> & { exercises: FittedExercise[] } {
  const available = o.available ?? (() => true);
  const cut = finisherStart(day.exercises);
  // A day that is nothing but core work keeps it as its main work.
  const split = cut === 0 ? day.exercises.length : cut;
  let main: FittedExercise[] = day.exercises.slice(0, split);
  let finisher: PlannedExercise[] = day.exercises.slice(split);
  const minutes = o.size.kind === 'minutes' ? o.size.n : 60;
  if (o.finisher && finisher.length === 0) {
    const uses = new Map<string, number>();
    const patterns = new Map<string, number>();
    // Count what the last few finishers used so today's picks something different.
    const recent = [...(o.finished ?? [])].sort((a, b) => b.startedAt - a.startedAt).slice(0, 6);
    for (const w of recent) for (const e of w.exercises) {
      const mv = MOVE_BY_ID.get(e.exerciseId);
      if (!mv || !isFinisherMove(mv)) continue;
      uses.set(mv.id, (uses.get(mv.id) ?? 0) + 1);
      patterns.set(mv.pattern, (patterns.get(mv.pattern) ?? 0) + 1);
    }
    const inMain = new Set(main.map((e) => e.exerciseId));
    const pool = MOVES.filter((mv) => isFinisherMove(mv) && available(mv.id) && !inMain.has(mv.id));
    finisher = pickFinisher(pool, uses, patterns).map((mv) => finisherPrescription(mv, minutes));
  }
  if (o.size.kind === 'plan') return { ...day, exercises: [...main, ...finisher] };

  const budget = o.size.n * 60 - finisher.reduce((n, e) => n + exerciseSeconds(e), 0);
  const seconds = (list: PlannedExercise[]) => list.reduce((n, e) => n + exerciseSeconds(e), 0);
  const wantMore = (next: PlannedExercise) => o.size.kind === 'exercises'
    ? main.length < o.size.n
    : seconds(main) + exerciseSeconds(next) <= budget;
  const tooMany = () => o.size.kind === 'exercises' ? main.length > o.size.n : seconds(main) > budget;

  while (main.length > 1 && tooMany()) main = main.slice(0, -1);

  const used = new Set(main.map((e) => e.exerciseId));
  // What the day is for: the muscle groups its own exercises mainly train.
  const groups: Partial<Record<Group, number>> = {};
  const today: Tally = {};
  const patterns = new Set<string>();
  for (const e of main) {
    const mv = moveLike(e.exerciseId);
    if (!mv) continue;
    used.add(mv.id);
    add(today, mv);
    patterns.add(mv.pattern);
    for (const [g, c] of groupCredit(mv)) groups[g] = (groups[g] ?? 0) + c;
  }
  // Groups only one lift touches on the side (hamstrings from a deadlift on pull day) aren't the day's job.
  const top = Math.max(0, ...Object.values(groups));
  for (const g of Object.keys(groups) as Group[]) {
    const share = groups[g]! / top;
    if (share < 0.5) delete groups[g];
    else groups[g] = Math.min(1, share * 1.5);
  }
  if (Object.keys(groups).length === 0) return { ...day, exercises: [...main, ...finisher] };
  const focus: Focus = { spread: 0.4, groups };
  const pool = MOVES.filter((mv) => !isFinisherMove(mv) && available(mv.id) && !used.has(mv.id));
  const plan = (mv: Move): FittedExercise => ({ exerciseId: mv.id, ...prescription('muscle', 'intermediate', mv.compound), added: true });
  while (main.length < MAX_MAIN + 4) {
    let best: Move | undefined;
    let bestScore = 0;
    for (const mv of pool) {
      if (used.has(mv.id)) continue;
      // A movement the day already has is a last resort when filling it up.
      const s = score(mv, focus, today, {}, patterns, new Set(), 'muscle') * (patterns.has(mv.pattern) ? 0.3 : 1);
      if (s > bestScore) { best = mv; bestScore = s; }
    }
    if (!best || !wantMore(plan(best))) break;
    main.push(plan(best));
    used.add(best.id);
    add(today, best);
    patterns.add(best.pattern);
  }
  return { ...day, exercises: [...main, ...finisher] };
}

/** The session size saved in settings. */
export function sessionSize(s: { sessionSize?: 'plan' | 'exercises' | 'minutes'; sessionExercises?: number; sessionMinutes?: number }): SessionSize {
  if (s.sessionSize === 'exercises') return { kind: 'exercises', n: s.sessionExercises ?? 6 };
  if (s.sessionSize === 'minutes') return { kind: 'minutes', n: s.sessionMinutes ?? 60 };
  return { kind: 'plan' };
}

/**
 * Which day of a split comes next: the one after the last day of it you finished, whatever day you
 * picked, so training 4, 5 or 6 times a week just keeps rotating. Falls back to the saved index.
 */
export function nextDayIndex(program: Pick<Program, 'id' | 'days'>, finished: Workout[] | undefined, saved: number): number {
  const n = Math.max(1, program.days.length);
  const last = lastSplitDay(program, finished);
  return last ? (last.index + 1) % n : saved % n;
}

export function lastSplitDay(program: Pick<Program, 'id' | 'days'>, finished: Workout[] | undefined): { index: number; at: number } | undefined {
  let best: { index: number; at: number } | undefined;
  for (const w of finished ?? []) {
    if (!w.finishedAt || w.programId !== program.id || !w.dayId) continue;
    const index = program.days.findIndex((d) => d.id === w.dayId);
    if (index >= 0 && (!best || w.startedAt > best.at)) best = { index, at: w.startedAt };
  }
  return best;
}
