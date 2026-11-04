/**
 * What each exercise trains, down to the part of the muscle. Muscles aren't one block: incline pressing
 * favours the upper chest, overhead extensions stretch the triceps long head, incline curls the biceps
 * long head, preacher curls the short head, seated calf raises the soleus. The generator uses these tags
 * to cover every part over a week instead of repeating the same kind of movement.
 */

export type Equipment = 'gym' | 'dumbbells' | 'bodyweight';

export type Target =
  | 'chestUpper' | 'chestMid' | 'chestLower'
  | 'deltFront' | 'deltSide' | 'deltRear'
  | 'lats' | 'upperBack' | 'lowerBack' | 'traps'
  | 'bicepsLong' | 'bicepsShort' | 'brachialis'
  | 'tricepsLong' | 'tricepsOuter'
  | 'quads' | 'rectusFemoris'
  | 'hamsHip' | 'hamsKnee'
  | 'glutes' | 'gluteSide'
  | 'gastroc' | 'soleus'
  | 'abs' | 'lowerAbs' | 'obliques';

export type Group =
  | 'chest' | 'delts' | 'rearDelts' | 'back' | 'lowerBack' | 'traps'
  | 'biceps' | 'triceps' | 'quads' | 'hams' | 'glutes' | 'calves' | 'core';

export const TARGETS: Record<Target, { label: string; group: Group; priority: number }> = {
  chestUpper: { label: 'Upper chest', group: 'chest', priority: 1 },
  chestMid: { label: 'Mid chest', group: 'chest', priority: 1 },
  // Flat pressing already works most of the lower chest, so it needs less dedicated work.
  chestLower: { label: 'Lower chest', group: 'chest', priority: 0.5 },
  // Every press hits the front delts hard; they rarely need their own exercise.
  deltFront: { label: 'Front delts', group: 'delts', priority: 0.45 },
  deltSide: { label: 'Side delts', group: 'delts', priority: 0.9 },
  deltRear: { label: 'Rear delts', group: 'rearDelts', priority: 0.8 },
  lats: { label: 'Lats (back width)', group: 'back', priority: 1.2 },
  upperBack: { label: 'Mid back (thickness)', group: 'back', priority: 1 },
  lowerBack: { label: 'Lower back', group: 'lowerBack', priority: 0.4 },
  traps: { label: 'Upper traps', group: 'traps', priority: 0.3 },
  bicepsLong: { label: 'Biceps long head', group: 'biceps', priority: 0.8 },
  bicepsShort: { label: 'Biceps short head', group: 'biceps', priority: 0.7 },
  brachialis: { label: 'Brachialis and forearm', group: 'biceps', priority: 0.5 },
  tricepsLong: { label: 'Triceps long head', group: 'triceps', priority: 0.85 },
  tricepsOuter: { label: 'Triceps outer heads', group: 'triceps', priority: 0.7 },
  quads: { label: 'Quads', group: 'quads', priority: 1 },
  rectusFemoris: { label: 'Rectus femoris (front quad)', group: 'quads', priority: 0.5 },
  hamsHip: { label: 'Hamstrings (hinge)', group: 'hams', priority: 1 },
  hamsKnee: { label: 'Hamstrings (curl)', group: 'hams', priority: 0.8 },
  glutes: { label: 'Glutes', group: 'glutes', priority: 1 },
  gluteSide: { label: 'Side glutes', group: 'glutes', priority: 0.35 },
  gastroc: { label: 'Calves (gastrocnemius)', group: 'calves', priority: 0.6 },
  soleus: { label: 'Calves (soleus)', group: 'calves', priority: 0.4 },
  abs: { label: 'Abs', group: 'core', priority: 0.6 },
  lowerAbs: { label: 'Lower abs', group: 'core', priority: 0.45 },
  obliques: { label: 'Obliques', group: 'core', priority: 0.4 },
};

export interface Move {
  id: string;
  /** The least equipment the exercise needs. */
  eq: Equipment;
  compound: boolean;
  /** Movement pattern. Two of the same in a day is usually redundant. */
  pattern: string;
  /** Preference among exercises that train the same thing: staples first, awkward or niche ones last. */
  quality: number;
  /** How hard it trains each target, 1 = main focus. */
  hits: Partial<Record<Target, number>>;
}

const m = (id: string, eq: Equipment, compound: boolean, pattern: string, quality: number, hits: Move['hits']): Move =>
  ({ id, eq, compound, pattern, quality, hits });

export const MOVES: Move[] = [
  // Chest: flat for the middle, incline for the upper fibres, decline and dips for the lower.
  m('Barbell_Bench_Press_-_Medium_Grip', 'gym', true, 'press-flat', 1, { chestMid: 1, chestLower: 0.5, deltFront: 0.4, tricepsOuter: 0.4 }),
  m('Dumbbell_Bench_Press', 'dumbbells', true, 'press-flat', 0.95, { chestMid: 1, chestLower: 0.4, deltFront: 0.4, tricepsOuter: 0.3 }),
  m('Machine_Bench_Press', 'gym', true, 'press-flat', 0.85, { chestMid: 1, chestLower: 0.4, deltFront: 0.4, tricepsOuter: 0.4 }),
  m('Pushups', 'bodyweight', true, 'press-flat', 0.75, { chestMid: 1, chestLower: 0.4, deltFront: 0.4, tricepsOuter: 0.4 }),
  m('Incline_Dumbbell_Press', 'dumbbells', true, 'press-incline', 1, { chestUpper: 1, chestMid: 0.4, deltFront: 0.6, tricepsOuter: 0.3 }),
  m('Barbell_Incline_Bench_Press_-_Medium_Grip', 'gym', true, 'press-incline', 0.95, { chestUpper: 1, chestMid: 0.4, deltFront: 0.6, tricepsOuter: 0.4 }),
  m('Leverage_Incline_Chest_Press', 'gym', true, 'press-incline', 0.85, { chestUpper: 1, chestMid: 0.4, deltFront: 0.5, tricepsOuter: 0.3 }),
  // Feet up makes a push-up an incline press.
  m('Decline_Push-Up', 'bodyweight', true, 'press-incline', 0.75, { chestUpper: 0.8, chestMid: 0.4, deltFront: 0.6, tricepsOuter: 0.4 }),
  m('Dips_-_Chest_Version', 'bodyweight', true, 'press-decline', 0.9, { chestLower: 1, chestMid: 0.4, tricepsOuter: 0.6, deltFront: 0.4 }),
  m('Decline_Barbell_Bench_Press', 'gym', true, 'press-decline', 0.8, { chestLower: 1, chestMid: 0.6, tricepsOuter: 0.4 }),
  m('Decline_Dumbbell_Bench_Press', 'dumbbells', true, 'press-decline', 0.8, { chestLower: 1, chestMid: 0.6, tricepsOuter: 0.3 }),
  // Hands up makes a push-up a decline press.
  m('Incline_Push-Up', 'bodyweight', true, 'press-decline', 0.6, { chestLower: 0.8, chestMid: 0.5, tricepsOuter: 0.3 }),
  m('Butterfly', 'gym', false, 'fly', 0.95, { chestMid: 1 }),
  m('Cable_Crossover', 'gym', false, 'fly', 1, { chestLower: 0.8, chestMid: 0.7 }),
  m('Low_Cable_Crossover', 'gym', false, 'fly', 0.9, { chestUpper: 1, chestMid: 0.4 }),
  m('Incline_Dumbbell_Flyes', 'dumbbells', false, 'fly', 0.9, { chestUpper: 1, chestMid: 0.4 }),
  m('Dumbbell_Flyes', 'dumbbells', false, 'fly', 0.9, { chestMid: 1, chestLower: 0.3 }),

  // Shoulders: presses for the front, raises for the side, reverse flyes and face pulls for the rear.
  m('Dumbbell_Shoulder_Press', 'dumbbells', true, 'press-vert', 1, { deltFront: 1, deltSide: 0.4, tricepsOuter: 0.4, chestUpper: 0.3 }),
  m('Standing_Military_Press', 'gym', true, 'press-vert', 1, { deltFront: 1, deltSide: 0.4, tricepsOuter: 0.4, chestUpper: 0.3 }),
  m('Leverage_Shoulder_Press', 'gym', true, 'press-vert', 0.85, { deltFront: 1, deltSide: 0.4, tricepsOuter: 0.4 }),
  m('Arnold_Dumbbell_Press', 'dumbbells', true, 'press-vert', 0.85, { deltFront: 1, deltSide: 0.5, tricepsOuter: 0.3 }),
  m('Side_Lateral_Raise', 'dumbbells', false, 'raise-side', 1, { deltSide: 1 }),
  m('Cable_Seated_Lateral_Raise', 'gym', false, 'raise-side', 0.95, { deltSide: 1 }),
  m('Front_Dumbbell_Raise', 'dumbbells', false, 'raise-front', 0.5, { deltFront: 1 }),
  m('Face_Pull', 'gym', false, 'rear', 1, { deltRear: 1, upperBack: 0.5, traps: 0.3 }),
  m('Reverse_Machine_Flyes', 'gym', false, 'rear', 0.95, { deltRear: 1, upperBack: 0.4 }),
  m('Reverse_Flyes', 'dumbbells', false, 'rear', 0.95, { deltRear: 1, upperBack: 0.4 }),

  // Back: vertical pulls for width (lats), rows for thickness (mid back).
  m('Wide-Grip_Lat_Pulldown', 'gym', true, 'pull-vert', 1, { lats: 1, upperBack: 0.3, brachialis: 0.3, bicepsShort: 0.3 }),
  m('Close-Grip_Front_Lat_Pulldown', 'gym', true, 'pull-vert', 0.9, { lats: 1, upperBack: 0.3, bicepsLong: 0.3, bicepsShort: 0.3 }),
  m('Pullups', 'bodyweight', true, 'pull-vert', 1, { lats: 1, upperBack: 0.4, brachialis: 0.3 }),
  m('Chin-Up', 'bodyweight', true, 'pull-vert', 0.95, { lats: 1, bicepsShort: 0.5, bicepsLong: 0.4 }),
  m('Rope_Straight-Arm_Pulldown', 'gym', false, 'pullover', 0.8, { lats: 1 }),
  m('Seated_Cable_Rows', 'gym', true, 'row', 1, { upperBack: 1, lats: 0.5, deltRear: 0.3, bicepsLong: 0.3 }),
  m('Bent_Over_Barbell_Row', 'gym', true, 'row', 1, { upperBack: 1, lats: 0.5, deltRear: 0.4, lowerBack: 0.4, bicepsLong: 0.3 }),
  m('T-Bar_Row_with_Handle', 'gym', true, 'row', 0.85, { upperBack: 1, lats: 0.5, deltRear: 0.3, lowerBack: 0.3 }),
  m('One-Arm_Dumbbell_Row', 'dumbbells', true, 'row', 1, { lats: 0.9, upperBack: 0.8, bicepsLong: 0.3 }),
  m('Dumbbell_Incline_Row', 'dumbbells', true, 'row', 0.9, { upperBack: 1, lats: 0.4, deltRear: 0.5 }),
  m('Bent_Over_Two-Dumbbell_Row', 'dumbbells', true, 'row', 0.85, { upperBack: 1, lats: 0.5, deltRear: 0.4, lowerBack: 0.3 }),
  m('Inverted_Row', 'bodyweight', true, 'row', 0.85, { upperBack: 1, lats: 0.5, deltRear: 0.4, bicepsLong: 0.3 }),
  m('Barbell_Shrug', 'gym', false, 'shrug', 0.8, { traps: 1 }),
  m('Dumbbell_Shrug', 'dumbbells', false, 'shrug', 0.8, { traps: 1 }),
  m('Hyperextensions_Back_Extensions', 'gym', false, 'back-ext', 0.75, { lowerBack: 1, glutes: 0.5, hamsHip: 0.5 }),

  // Biceps: arms behind the body (incline curl) for the long head, arms in front (preacher,
  // concentration) for the short head, neutral grip (hammer) for the brachialis.
  m('Barbell_Curl', 'gym', false, 'curl', 1, { bicepsShort: 0.8, bicepsLong: 0.8 }),
  m('Dumbbell_Bicep_Curl', 'dumbbells', false, 'curl', 1, { bicepsShort: 0.8, bicepsLong: 0.8 }),
  m('Standing_Biceps_Cable_Curl', 'gym', false, 'curl', 0.85, { bicepsShort: 0.8, bicepsLong: 0.8 }),
  m('Incline_Dumbbell_Curl', 'dumbbells', false, 'curl-long', 1, { bicepsLong: 1, bicepsShort: 0.4 }),
  m('Preacher_Curl', 'gym', false, 'curl-short', 0.95, { bicepsShort: 1, bicepsLong: 0.4, brachialis: 0.3 }),
  m('Machine_Preacher_Curls', 'gym', false, 'curl-short', 0.85, { bicepsShort: 1, bicepsLong: 0.4 }),
  m('Concentration_Curls', 'dumbbells', false, 'curl-short', 0.9, { bicepsShort: 1, bicepsLong: 0.4 }),
  m('Hammer_Curls', 'dumbbells', false, 'curl-hammer', 1, { brachialis: 1, bicepsLong: 0.5 }),
  m('Cable_Hammer_Curls_-_Rope_Attachment', 'gym', false, 'curl-hammer', 0.9, { brachialis: 1, bicepsLong: 0.5 }),
  m('Reverse_Barbell_Curl', 'gym', false, 'curl-hammer', 0.7, { brachialis: 1 }),

  // Triceps: overhead work stretches the long head, pushdowns and dips work the outer heads.
  m('Triceps_Overhead_Extension_with_Rope', 'gym', false, 'tri-overhead', 1, { tricepsLong: 1, tricepsOuter: 0.4 }),
  m('Standing_Dumbbell_Triceps_Extension', 'dumbbells', false, 'tri-overhead', 1, { tricepsLong: 1, tricepsOuter: 0.4 }),
  m('EZ-Bar_Skullcrusher', 'gym', false, 'tri-lying', 0.9, { tricepsLong: 0.7, tricepsOuter: 0.7 }),
  m('Triceps_Pushdown_-_Rope_Attachment', 'gym', false, 'tri-pushdown', 1, { tricepsOuter: 1, tricepsLong: 0.4 }),
  m('Triceps_Pushdown', 'gym', false, 'tri-pushdown', 0.95, { tricepsOuter: 1, tricepsLong: 0.3 }),
  m('Tricep_Dumbbell_Kickback', 'dumbbells', false, 'tri-pushdown', 0.75, { tricepsOuter: 0.8, tricepsLong: 0.5 }),
  m('Close-Grip_Barbell_Bench_Press', 'gym', true, 'press-close', 0.85, { tricepsOuter: 1, tricepsLong: 0.4, chestMid: 0.5, deltFront: 0.4 }),
  m('Dips_-_Triceps_Version', 'bodyweight', true, 'dip', 0.9, { tricepsOuter: 1, tricepsLong: 0.4, chestLower: 0.5, deltFront: 0.3 }),
  m('Push-Ups_-_Close_Triceps_Position', 'bodyweight', true, 'press-close', 0.75, { tricepsOuter: 1, chestMid: 0.5, deltFront: 0.3 }),
  m('Body_Tricep_Press', 'bodyweight', false, 'tri-lying', 0.65, { tricepsLong: 0.7, tricepsOuter: 0.7 }),
  m('Bench_Dips', 'bodyweight', false, 'dip', 0.7, { tricepsOuter: 1, tricepsLong: 0.3 }),

  // Quads: squats and lunges, plus leg extensions for the rectus femoris that squats barely stretch.
  m('Barbell_Squat', 'gym', true, 'squat', 1, { quads: 1, glutes: 0.8, lowerBack: 0.3 }),
  m('Leg_Press', 'gym', true, 'squat', 0.95, { quads: 1, glutes: 0.5 }),
  m('Hack_Squat', 'gym', true, 'squat', 0.9, { quads: 1, glutes: 0.4 }),
  m('Goblet_Squat', 'dumbbells', true, 'squat', 0.95, { quads: 1, glutes: 0.5 }),
  m('Dumbbell_Squat', 'dumbbells', true, 'squat', 0.85, { quads: 1, glutes: 0.6 }),
  m('Bodyweight_Squat', 'bodyweight', true, 'squat', 0.6, { quads: 0.8, glutes: 0.4 }),
  m('Split_Squat_with_Dumbbells', 'dumbbells', true, 'lunge', 0.95, { quads: 1, glutes: 0.7, gluteSide: 0.3 }),
  m('Dumbbell_Lunges', 'dumbbells', true, 'lunge', 0.95, { quads: 1, glutes: 0.7, gluteSide: 0.3 }),
  m('Dumbbell_Rear_Lunge', 'dumbbells', true, 'lunge', 0.9, { glutes: 1, quads: 0.8, gluteSide: 0.3 }),
  m('Dumbbell_Step_Ups', 'dumbbells', true, 'lunge', 0.85, { quads: 0.9, glutes: 0.9, gluteSide: 0.3 }),
  m('Bodyweight_Walking_Lunge', 'bodyweight', true, 'lunge', 0.8, { quads: 0.9, glutes: 0.7, gluteSide: 0.3 }),
  m('Leg_Extensions', 'gym', false, 'knee-ext', 1, { rectusFemoris: 1, quads: 0.6 }),

  // Hamstrings work at the hip (hinges) and the knee (curls); a full plan needs both.
  m('Romanian_Deadlift', 'gym', true, 'hinge', 1, { hamsHip: 1, glutes: 0.8, lowerBack: 0.5 }),
  m('Stiff-Legged_Dumbbell_Deadlift', 'dumbbells', true, 'hinge', 0.95, { hamsHip: 1, glutes: 0.7, lowerBack: 0.4 }),
  m('Barbell_Deadlift', 'gym', true, 'hinge', 0.9, { glutes: 0.8, hamsHip: 0.7, lowerBack: 0.8, quads: 0.3, upperBack: 0.3, traps: 0.5 }),
  m('Good_Morning', 'gym', true, 'hinge', 0.7, { hamsHip: 1, lowerBack: 0.7, glutes: 0.5 }),
  m('Seated_Leg_Curl', 'gym', false, 'leg-curl', 1, { hamsKnee: 1 }),
  m('Lying_Leg_Curls', 'gym', false, 'leg-curl', 0.95, { hamsKnee: 1 }),
  m('Ball_Leg_Curl', 'dumbbells', false, 'leg-curl', 0.75, { hamsKnee: 1, glutes: 0.3 }),
  m('Natural_Glute_Ham_Raise', 'bodyweight', false, 'leg-curl', 0.6, { hamsKnee: 1, hamsHip: 0.3 }),

  // Glutes: hip thrusts and bridges for the glute max, abduction for the side.
  m('Barbell_Hip_Thrust', 'gym', true, 'bridge', 1, { glutes: 1, hamsHip: 0.3 }),
  m('Barbell_Glute_Bridge', 'gym', true, 'bridge', 0.9, { glutes: 1 }),
  m('Single_Leg_Glute_Bridge', 'bodyweight', false, 'bridge', 0.75, { glutes: 1, hamsHip: 0.3 }),
  m('Thigh_Abductor', 'gym', false, 'abduction', 0.85, { gluteSide: 1 }),

  // Calves: straight-knee raises for the gastrocnemius, bent-knee (seated) for the soleus.
  m('Standing_Calf_Raises', 'gym', false, 'calf-straight', 1, { gastroc: 1, soleus: 0.4 }),
  m('Calf_Raise_On_A_Dumbbell', 'dumbbells', false, 'calf-straight', 0.9, { gastroc: 1, soleus: 0.4 }),
  m('Seated_Calf_Raise', 'gym', false, 'calf-bent', 1, { soleus: 1, gastroc: 0.3 }),
  m('Dumbbell_Seated_One-Leg_Calf_Raise', 'dumbbells', false, 'calf-bent', 0.85, { soleus: 1, gastroc: 0.3 }),

  // Core: crunches for the upper abs, leg raises for the lower, anti-rotation for the obliques.
  m('Cable_Crunch', 'gym', false, 'crunch', 1, { abs: 1 }),
  m('Crunches', 'bodyweight', false, 'crunch', 0.7, { abs: 1 }),
  m('Hanging_Leg_Raise', 'bodyweight', false, 'leg-raise', 0.95, { lowerAbs: 1, abs: 0.6 }),
  m('Reverse_Crunch', 'bodyweight', false, 'leg-raise', 0.85, { lowerAbs: 1, abs: 0.6 }),
  m('Dead_Bug', 'bodyweight', false, 'anti-ext', 0.8, { abs: 0.7, lowerAbs: 0.5, obliques: 0.3 }),
  m('Pallof_Press', 'gym', false, 'anti-rot', 0.95, { obliques: 1, abs: 0.3 }),
  m('Side_Bridge', 'bodyweight', false, 'anti-rot', 0.8, { obliques: 1 }),
];

export const MOVE_BY_ID = new Map(MOVES.map((mv) => [mv.id, mv]));

/** The parts an exercise mainly trains, strongest first, as labels for the UI. */
export function mainTargets(exerciseId: string, min = 0.6): string[] {
  const mv = MOVE_BY_ID.get(exerciseId);
  if (!mv) return [];
  return (Object.entries(mv.hits) as [Target, number][])
    .filter(([, w]) => w >= min)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => TARGETS[t].label);
}

export const GROUP_LABEL: Record<Group, string> = {
  chest: 'Chest', delts: 'Shoulders', rearDelts: 'Rear delts', back: 'Back', lowerBack: 'Lower back', traps: 'Traps',
  biceps: 'Biceps', triceps: 'Triceps', quads: 'Quads', hams: 'Hamstrings', glutes: 'Glutes', calves: 'Calves', core: 'Abs',
};

/**
 * How much one set of an exercise counts toward each muscle group's weekly sets: a full set where
 * the group is a main target, half where it's clearly worked too (the same rule as Muscle balance).
 */
export function groupCredit(mv: Move): Map<Group, number> {
  const best = new Map<Group, number>();
  for (const [t, w] of Object.entries(mv.hits) as [Target, number][]) {
    const g = TARGETS[t].group;
    best.set(g, Math.max(best.get(g) ?? 0, w));
  }
  const out = new Map<Group, number>();
  for (const [g, w] of best) if (w >= 0.4) out.set(g, w >= 0.8 ? 1 : 0.5);
  return out;
}

/** How alike two exercises are in what they train, from 0 (nothing shared) to 1 (the same areas). */
export function similarity(a: Move, b: Move): number {
  let dot = 0, na = 0, nb = 0;
  for (const t of Object.keys(TARGETS) as Target[]) {
    const x = a.hits[t] ?? 0, y = b.hits[t] ?? 0;
    dot += x * y; na += x * x; nb += y * y;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
