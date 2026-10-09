import type { Day, PlannedExercise, Program } from '../types';

export type Goal = 'strength' | 'muscle' | 'general';
export type Experience = 'beginner' | 'intermediate';
export type Equipment = 'gym' | 'dumbbells' | 'bodyweight';

export interface GeneratorInput {
  goal: Goal;
  days: number; // 2–6
  experience: Experience;
  equipment: Equipment;
  minutes: number; // 30 | 45 | 60 | 90
}

type Pattern =
  | 'squat' | 'hinge' | 'hpush' | 'vpush' | 'hpull' | 'vpull' | 'lunge' | 'glute'
  | 'quad' | 'ham' | 'calf' | 'chest-iso' | 'side-delt' | 'rear-delt' | 'biceps' | 'triceps' | 'core';

const COMPOUND: Set<Pattern> = new Set(['squat', 'hinge', 'hpush', 'vpush', 'hpull', 'vpull', 'lunge', 'glute']);

/** Exercise options per movement pattern, best first, tagged with the least equipment they need. */
const OPTIONS: Record<Pattern, [string, Equipment][]> = {
  squat: [['Barbell_Squat', 'gym'], ['Leg_Press', 'gym'], ['Goblet_Squat', 'dumbbells'], ['Dumbbell_Squat', 'dumbbells'], ['Bodyweight_Squat', 'bodyweight']],
  hinge: [['Romanian_Deadlift', 'gym'], ['Barbell_Deadlift', 'gym'], ['Stiff-Legged_Dumbbell_Deadlift', 'dumbbells'], ['Single_Leg_Glute_Bridge', 'bodyweight']],
  hpush: [['Barbell_Bench_Press_-_Medium_Grip', 'gym'], ['Dumbbell_Bench_Press', 'dumbbells'], ['Incline_Dumbbell_Press', 'dumbbells'], ['Machine_Bench_Press', 'gym'], ['Pushups', 'bodyweight'], ['Decline_Push-Up', 'bodyweight']],
  vpush: [['Dumbbell_Shoulder_Press', 'dumbbells'], ['Standing_Military_Press', 'gym'], ['Leverage_Shoulder_Press', 'gym'], ['Decline_Push-Up', 'bodyweight']],
  hpull: [['Seated_Cable_Rows', 'gym'], ['Bent_Over_Barbell_Row', 'gym'], ['One-Arm_Dumbbell_Row', 'dumbbells'], ['Bent_Over_Two-Dumbbell_Row', 'dumbbells'], ['Inverted_Row', 'bodyweight']],
  vpull: [['Wide-Grip_Lat_Pulldown', 'gym'], ['Close-Grip_Front_Lat_Pulldown', 'gym'], ['Pullups', 'bodyweight'], ['Chin-Up', 'bodyweight']],
  lunge: [['Split_Squat_with_Dumbbells', 'dumbbells'], ['Dumbbell_Lunges', 'dumbbells'], ['Dumbbell_Rear_Lunge', 'dumbbells'], ['Bodyweight_Walking_Lunge', 'bodyweight']],
  glute: [['Barbell_Hip_Thrust', 'gym'], ['Barbell_Glute_Bridge', 'gym'], ['Single_Leg_Glute_Bridge', 'bodyweight']],
  quad: [['Leg_Extensions', 'gym'], ['Goblet_Squat', 'dumbbells'], ['Bodyweight_Squat', 'bodyweight']],
  ham: [['Lying_Leg_Curls', 'gym'], ['Seated_Leg_Curl', 'gym'], ['Stiff-Legged_Dumbbell_Deadlift', 'dumbbells'], ['Single_Leg_Glute_Bridge', 'bodyweight']],
  calf: [['Standing_Calf_Raises', 'gym'], ['Seated_Calf_Raise', 'gym'], ['Calf_Raise_On_A_Dumbbell', 'dumbbells']],
  'chest-iso': [['Cable_Crossover', 'gym'], ['Butterfly', 'gym'], ['Dumbbell_Flyes', 'dumbbells'], ['Incline_Push-Up', 'bodyweight']],
  'side-delt': [['Side_Lateral_Raise', 'dumbbells'], ['Cable_Seated_Lateral_Raise', 'gym']],
  'rear-delt': [['Face_Pull', 'gym'], ['Reverse_Machine_Flyes', 'gym'], ['Reverse_Flyes', 'dumbbells']],
  biceps: [['Dumbbell_Bicep_Curl', 'dumbbells'], ['Barbell_Curl', 'gym'], ['Hammer_Curls', 'dumbbells'], ['Chin-Up', 'bodyweight']],
  triceps: [['Triceps_Pushdown_-_Rope_Attachment', 'gym'], ['Triceps_Pushdown', 'gym'], ['Standing_Dumbbell_Triceps_Extension', 'dumbbells'], ['Bench_Dips', 'bodyweight']],
  core: [['Hanging_Leg_Raise', 'bodyweight'], ['Cable_Crunch', 'gym'], ['Dead_Bug', 'bodyweight'], ['Reverse_Crunch', 'bodyweight']],
};

/** Every exercise id the generator can choose, for checking against the library. */
export const GENERATOR_EXERCISES = [...new Set(Object.values(OPTIONS).flat().map(([id]) => id))];

const ALLOWED: Record<Equipment, Equipment[]> = {
  gym: ['gym', 'dumbbells', 'bodyweight'],
  dumbbells: ['dumbbells', 'bodyweight'],
  bodyweight: ['bodyweight'],
};

// Day templates: movement patterns in priority order (time limits cut from the end).
const T = {
  fullA: ['squat', 'hpush', 'hpull', 'hinge', 'vpush', 'core', 'biceps', 'triceps'],
  fullB: ['hinge', 'vpush', 'vpull', 'lunge', 'hpush', 'calf', 'rear-delt', 'core'],
  fullC: ['squat', 'hpull', 'hpush', 'glute', 'vpull', 'side-delt', 'triceps', 'biceps'],
  upper: ['hpush', 'hpull', 'vpush', 'vpull', 'side-delt', 'biceps', 'triceps', 'rear-delt'],
  lower: ['squat', 'hinge', 'lunge', 'ham', 'calf', 'glute', 'quad', 'core'],
  push: ['hpush', 'vpush', 'hpush', 'chest-iso', 'side-delt', 'triceps', 'triceps', 'core'],
  pull: ['vpull', 'hpull', 'hinge', 'rear-delt', 'biceps', 'hpull', 'biceps', 'core'],
  legs: ['squat', 'hinge', 'lunge', 'ham', 'quad', 'calf', 'glute', 'core'],
} satisfies Record<string, Pattern[]>;

function splitFor(days: number, experience: Experience): { name: string; days: [string, Pattern[]][] } {
  switch (Math.max(2, Math.min(6, days))) {
    case 2:
      return { name: 'Full Body', days: [['Full Body A', T.fullA], ['Full Body B', T.fullB]] };
    case 3:
      return experience === 'beginner'
        ? { name: 'Full Body', days: [['Full Body A', T.fullA], ['Full Body B', T.fullB], ['Full Body C', T.fullC]] }
        : { name: 'Push / Pull / Legs', days: [['Push', T.push], ['Pull', T.pull], ['Legs', T.legs]] };
    case 4:
      return { name: 'Upper / Lower', days: [['Upper A', T.upper], ['Lower A', T.lower], ['Upper B', T.upper], ['Lower B', T.lower]] };
    case 5:
      return { name: 'PPL + Upper / Lower', days: [['Push', T.push], ['Pull', T.pull], ['Legs', T.legs], ['Upper', T.upper], ['Lower', T.lower]] };
    default:
      return { name: 'Push / Pull / Legs ×2', days: [['Push A', T.push], ['Pull A', T.pull], ['Legs A', T.legs], ['Push B', T.push], ['Pull B', T.pull], ['Legs B', T.legs]] };
  }
}

const EXERCISES_PER_SESSION: Record<number, number> = { 30: 4, 45: 5, 60: 6, 90: 8 };

function prescription(goal: Goal, experience: Experience, compound: boolean) {
  const base = {
    strength: compound ? { sets: 4, repMin: 4, repMax: 6, rest: 180 } : { sets: 3, repMin: 8, repMax: 12, rest: 90 },
    muscle: compound ? { sets: 3, repMin: 6, repMax: 10, rest: 120 } : { sets: 3, repMin: 10, repMax: 15, rest: 75 },
    general: compound ? { sets: 3, repMin: 8, repMax: 12, rest: 90 } : { sets: 2, repMin: 12, repMax: 15, rest: 60 },
  }[goal];
  // Beginners recover better from slightly less volume on the heaviest work.
  return experience === 'beginner' && base.sets >= 4 ? { ...base, sets: base.sets - 1 } : base;
}

/** Builds a program from quiz answers. Pure and deterministic, so the same answers give the same routine. */
export function generateProgram(input: GeneratorInput, id: string, now = Date.now()): Program {
  const split = splitFor(input.days, input.experience);
  const allowed = new Set(ALLOWED[input.equipment]);
  const perSession = EXERCISES_PER_SESSION[input.minutes] ?? 6;
  // Repeated day names (Upper A / Upper B) and repeated patterns in a day pick the next option, for variety.
  const seenTemplate = new Map<Pattern[], number>();

  const days: Day[] = split.days.map(([name, template], di) => {
    const variant = seenTemplate.get(template) ?? 0;
    seenTemplate.set(template, variant + 1);
    const used = new Set<string>();
    const exercises: PlannedExercise[] = [];
    for (const pattern of template) {
      if (exercises.length >= perSession) break;
      const options = OPTIONS[pattern].filter(([ex, eq]) => allowed.has(eq) && !used.has(ex)).map(([ex]) => ex);
      if (options.length === 0) continue;
      const exerciseId = options[variant % options.length];
      used.add(exerciseId);
      exercises.push({ exerciseId, ...prescription(input.goal, input.experience, COMPOUND.has(pattern)) });
    }
    return { id: `${id}-d${di}`, name, exercises };
  });

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
