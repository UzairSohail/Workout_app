import type { Day, PlannedExercise, Program } from '../types';
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
    let left = budget - finisher.reduce((n, e) => n + exerciseSeconds(e), 0);
    const today: Tally = {};
    const patterns = new Set<string>();
    const picked: Move[] = [];
    while (picked.length < MAX_MAIN) {
      let best: Move | undefined;
      let bestScore = 0;
      for (const mv of pool) {
        if (picked.includes(mv)) continue;
        if (picked.length >= MIN_MAIN && (exerciseSeconds(plan(mv)) > left || !fitsWeek(mv))) continue;
        const s = score(mv, focus, today, week, patterns, usedThisWeek, input.goal);
        if (s > bestScore) { best = mv; bestScore = s; }
      }
      if (!best) break;
      left -= exerciseSeconds(plan(best));
      for (const [g, c] of groupCredit(best)) floorSets.set(g, (floorSets.get(g) ?? 0) + c * MIN_SETS);
      picked.push(best);
      add(today, best);
      patterns.add(best.pattern);
    }
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
