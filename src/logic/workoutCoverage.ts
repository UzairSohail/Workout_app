import type { Exercise } from '../types';
import { covers } from './generator';
import { subAreas } from './subAreas';
import { GROUP_LABEL, TARGETS, type Group, type Target } from './targets';

/** Short names for a part inside its group: "Chest: upper, mid". */
const SHORT: Record<Target, string> = {
  chestUpper: 'upper', chestMid: 'mid', chestLower: 'lower',
  deltFront: 'front', deltSide: 'side', deltRear: 'rear',
  lats: 'lats', upperBack: 'mid back', lowerBack: 'lower back', traps: 'traps',
  bicepsLong: 'long head', bicepsShort: 'short head', brachialis: 'brachialis',
  tricepsLong: 'long head', tricepsOuter: 'outer heads',
  quads: 'main', rectusFemoris: 'rectus femoris',
  hamsHip: 'hinge', hamsKnee: 'curl',
  glutes: 'max', gluteSide: 'side',
  gastroc: 'gastrocnemius', soleus: 'soleus',
  abs: 'upper', lowerAbs: 'lower', obliques: 'obliques',
};

/** Order the note lists groups in, top of the body to bottom. Upper traps only get spill-over, so they're left out. */
const ORDER: Group[] = ['chest', 'delts', 'rearDelts', 'back', 'biceps', 'triceps', 'quads', 'hams', 'glutes', 'calves', 'core', 'lowerBack'];
const LEGS: Group[] = ['quads', 'hams', 'glutes', 'calves'];

const partsOf = (g: Group) => (Object.keys(TARGETS) as Target[]).filter((t) => TARGETS[t].group === g);

export interface CoverLine { group: Group; label: string; parts: string[] }

export interface WorkoutCoverage {
  /** Groups with at least one part getting its own exercise, with those parts. */
  covered: CoverLine[];
  /** What gets no dedicated work: whole groups by name, plus parts left out of covered groups. */
  skipped: string[];
}

/** One exercise's parts as labels: what it mainly trains, then what it helps with. */
export function exerciseParts(ex: Exercise | undefined): { main: string[]; also: string[] } {
  const hits = Object.entries(subAreas(ex)) as [Target, number][];
  hits.sort((a, b) => b[1] - a[1]);
  return {
    main: hits.filter(([, w]) => w >= 0.6).map(([t]) => TARGETS[t].label),
    also: hits.filter(([, w]) => w >= 0.3 && w < 0.6).map(([t]) => TARGETS[t].label),
  };
}

/** What a workout trains for real (a part counts once an exercise focuses on it, same rule as the routine builder) and what it leaves out. */
export function workoutCoverage(exercises: (Exercise | undefined)[]): WorkoutCoverage {
  const hit = new Set<Target>();
  for (const ex of exercises) {
    const hits = subAreas(ex);
    for (const t of Object.keys(hits) as Target[]) if (covers({ hits }, t)) hit.add(t);
  }
  const covered: CoverLine[] = [];
  const skippedGroups: Group[] = [];
  const missedParts: string[] = [];
  for (const g of ORDER) {
    const parts = partsOf(g);
    const done = parts.filter((t) => hit.has(t));
    if (!done.length) { skippedGroups.push(g); continue; }
    covered.push({ group: g, label: GROUP_LABEL[g], parts: parts.length > 1 ? done.map((t) => SHORT[t]) : [] });
    for (const t of parts) if (!hit.has(t)) missedParts.push(TARGETS[t].label);
  }
  // A day with no leg work at all reads better as "Legs" than four separate names.
  const noLegs = LEGS.every((g) => skippedGroups.includes(g));
  const skipped: string[] = [];
  for (const g of skippedGroups) {
    if (noLegs && LEGS.includes(g)) { if (g === 'quads') skipped.push('Legs'); continue; }
    skipped.push(GROUP_LABEL[g]);
  }
  return { covered, skipped: [...skipped, ...missedParts] };
}
