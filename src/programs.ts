import type { Day, PlannedExercise, Program, SchemeKind } from './types';

const ex = (exerciseId: string, sets: number, repMin: number, repMax: number, rest = 120): PlannedExercise => ({
  exerciseId, sets, repMin, repMax, rest,
});
const day = (id: string, name: string, exercises: PlannedExercise[]): Day => ({ id, name, exercises });

const scheme = (exerciseId: string, kind: SchemeKind, sets = 1, reps = 5, rest = 180): PlannedExercise => ({
  exerciseId, sets, repMin: reps, repMax: reps, rest, scheme: kind,
});

const SQUAT = 'Barbell_Squat';
const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const DEADLIFT = 'Barbell_Deadlift';
const OHP = 'Standing_Military_Press';
const ROW = 'Bent_Over_Barbell_Row';

const compound = (id: string, sets = 3, min = 6, max = 10) => ex(id, sets, min, max, 150);
const accessory = (id: string, sets = 3, min = 10, max = 15) => ex(id, sets, min, max, 75);

export const BUILT_IN_PROGRAMS: Program[] = [
  {
    id: 'builtin-full-body',
    name: 'Full Body (A/B)',
    description: '2–3 days a week, alternating A and B. Great for beginners or busy weeks.',
    builtIn: true,
    createdAt: 1,
    days: [
      day('fb-a', 'Full Body A', [
        compound('Barbell_Squat', 3, 5, 8),
        compound('Barbell_Bench_Press_-_Medium_Grip', 3, 6, 10),
        compound('Seated_Cable_Rows', 3, 8, 12),
        accessory('Dumbbell_Shoulder_Press', 2, 8, 12),
        accessory('Hanging_Leg_Raise', 3, 8, 15),
      ]),
      day('fb-b', 'Full Body B', [
        compound('Romanian_Deadlift', 3, 6, 10),
        compound('Dumbbell_Bench_Press', 3, 8, 12),
        compound('Wide-Grip_Lat_Pulldown', 3, 8, 12),
        accessory('Leg_Press', 2, 10, 15),
        accessory('Dumbbell_Bicep_Curl', 2, 10, 15),
        accessory('Triceps_Pushdown', 2, 10, 15),
      ]),
    ],
  },
  {
    id: 'builtin-upper-lower',
    name: 'Upper / Lower',
    description: '4 days a week: Upper, Lower, rest, Upper, Lower.',
    builtIn: true,
    createdAt: 2,
    days: [
      day('ul-u1', 'Upper A', [
        compound('Barbell_Bench_Press_-_Medium_Grip', 4, 5, 8),
        compound('Bent_Over_Barbell_Row', 4, 6, 10),
        accessory('Dumbbell_Shoulder_Press', 3, 8, 12),
        accessory('Wide-Grip_Lat_Pulldown', 3, 10, 12),
        accessory('Dumbbell_Bicep_Curl', 2, 10, 15),
        accessory('Triceps_Pushdown_-_Rope_Attachment', 2, 10, 15),
      ]),
      day('ul-l1', 'Lower A', [
        compound('Barbell_Squat', 4, 5, 8),
        compound('Romanian_Deadlift', 3, 8, 10),
        accessory('Leg_Press', 3, 10, 15),
        accessory('Seated_Leg_Curl', 3, 10, 15),
        accessory('Standing_Calf_Raises', 3, 10, 15),
      ]),
      day('ul-u2', 'Upper B', [
        compound('Standing_Military_Press', 4, 5, 8),
        compound('Pullups', 3, 5, 10),
        accessory('Incline_Dumbbell_Press', 3, 8, 12),
        accessory('Seated_Cable_Rows', 3, 10, 12),
        accessory('Side_Lateral_Raise', 3, 12, 20),
        accessory('Hammer_Curls', 2, 10, 15),
      ]),
      day('ul-l2', 'Lower B', [
        compound('Barbell_Deadlift', 3, 3, 6),
        accessory('Split_Squat_with_Dumbbells', 3, 8, 12),
        accessory('Barbell_Hip_Thrust', 3, 8, 12),
        accessory('Leg_Extensions', 3, 12, 15),
        accessory('Seated_Calf_Raise', 3, 12, 20),
      ]),
    ],
  },
  {
    id: 'builtin-ppl',
    name: 'Push / Pull / Legs',
    description: 'Run it 3 days a week, or twice through for 6 days.',
    builtIn: true,
    createdAt: 3,
    days: [
      day('ppl-push', 'Push', [
        compound('Barbell_Bench_Press_-_Medium_Grip', 4, 5, 8),
        compound('Seated_Barbell_Military_Press', 3, 6, 10),
        accessory('Incline_Dumbbell_Press', 3, 8, 12),
        accessory('Side_Lateral_Raise', 3, 12, 20),
        accessory('Triceps_Pushdown_-_Rope_Attachment', 3, 10, 15),
        accessory('Cable_Rope_Overhead_Triceps_Extension', 2, 10, 15),
      ]),
      day('ppl-pull', 'Pull', [
        compound('Barbell_Deadlift', 3, 3, 6),
        compound('Pullups', 3, 5, 10),
        accessory('Seated_Cable_Rows', 3, 8, 12),
        accessory('Face_Pull', 3, 12, 20),
        accessory('Barbell_Curl', 3, 8, 12),
        accessory('Hammer_Curls', 2, 10, 15),
      ]),
      day('ppl-legs', 'Legs', [
        compound('Barbell_Squat', 4, 5, 8),
        compound('Romanian_Deadlift', 3, 8, 10),
        accessory('Leg_Press', 3, 10, 15),
        accessory('Lying_Leg_Curls', 3, 10, 15),
        accessory('Barbell_Hip_Thrust', 3, 8, 12),
        accessory('Standing_Calf_Raises', 4, 10, 15),
      ]),
    ],
  },
  {
    id: 'builtin-bro',
    name: 'Bro Split',
    description: '5 days a week, one muscle group per day.',
    builtIn: true,
    createdAt: 4,
    days: [
      day('bro-chest', 'Chest', [
        compound('Barbell_Bench_Press_-_Medium_Grip', 4, 6, 10),
        compound('Incline_Dumbbell_Press', 3, 8, 12),
        accessory('Cable_Crossover', 3, 12, 15),
        accessory('Dips_-_Chest_Version', 3, 8, 15),
      ]),
      day('bro-back', 'Back', [
        compound('Bent_Over_Barbell_Row', 4, 6, 10),
        compound('Wide-Grip_Lat_Pulldown', 3, 8, 12),
        accessory('One-Arm_Dumbbell_Row', 3, 8, 12),
        accessory('Straight-Arm_Pulldown', 3, 12, 15),
      ]),
      day('bro-shoulders', 'Shoulders', [
        compound('Dumbbell_Shoulder_Press', 4, 6, 10),
        accessory('Side_Lateral_Raise', 4, 12, 20),
        accessory('Reverse_Machine_Flyes', 3, 12, 15),
        accessory('Dumbbell_Shrug', 3, 10, 15),
      ]),
      day('bro-legs', 'Legs', [
        compound('Barbell_Squat', 4, 5, 8),
        accessory('Leg_Press', 3, 10, 15),
        accessory('Lying_Leg_Curls', 3, 10, 15),
        accessory('Leg_Extensions', 3, 12, 15),
        accessory('Standing_Calf_Raises', 4, 10, 15),
      ]),
      day('bro-arms', 'Arms', [
        compound('Close-Grip_Barbell_Bench_Press', 3, 6, 10),
        accessory('Barbell_Curl', 3, 8, 12),
        accessory('Triceps_Pushdown', 3, 10, 15),
        accessory('Incline_Dumbbell_Curl', 3, 10, 15),
        accessory('Hammer_Curls', 3, 10, 15),
      ]),
    ],
  },
  {
    id: 'builtin-5x5',
    name: '5×5 Linear (beginner)',
    description: '3 days a week, alternating A and B. Add weight every session you get all your reps; 3 misses in a row drops the weight 10%.',
    builtIn: true,
    createdAt: 5,
    days: [
      day('5x5-a', 'Workout A', [
        scheme(SQUAT, 'linear', 5, 5),
        scheme(BENCH, 'linear', 5, 5),
        scheme(ROW, 'linear', 5, 5),
      ]),
      day('5x5-b', 'Workout B', [
        scheme(SQUAT, 'linear', 5, 5),
        scheme(OHP, 'linear', 5, 5),
        scheme(DEADLIFT, 'linear', 1, 5),
      ]),
    ],
  },
  {
    id: 'builtin-gzclp',
    name: 'GZCLP',
    description: '3–4 days a week, rotating A1, B1, A2, B2. Heavy T1 lifts, volume T2 lifts and light T3 accessories, each with its own progression.',
    builtIn: true,
    createdAt: 6,
    days: [
      day('gz-a1', 'A1', [
        scheme(SQUAT, 'gzcl-t1', 5, 3, 180),
        scheme(BENCH, 'gzcl-t2', 3, 10, 120),
        scheme('Wide-Grip_Lat_Pulldown', 'gzcl-t3', 3, 15, 75),
      ]),
      day('gz-b1', 'B1', [
        scheme(OHP, 'gzcl-t1', 5, 3, 180),
        scheme(DEADLIFT, 'gzcl-t2', 3, 10, 120),
        scheme('One-Arm_Dumbbell_Row', 'gzcl-t3', 3, 15, 75),
      ]),
      day('gz-a2', 'A2', [
        scheme(BENCH, 'gzcl-t1', 5, 3, 180),
        scheme(SQUAT, 'gzcl-t2', 3, 10, 120),
        scheme('Wide-Grip_Lat_Pulldown', 'gzcl-t3', 3, 15, 75),
      ]),
      day('gz-b2', 'B2', [
        scheme(DEADLIFT, 'gzcl-t1', 5, 3, 180),
        scheme(OHP, 'gzcl-t2', 3, 10, 120),
        scheme('One-Arm_Dumbbell_Row', 'gzcl-t3', 3, 15, 75),
      ]),
    ],
  },
  {
    id: 'builtin-531',
    name: '5/3/1 (4 days)',
    description: '4-week cycles of 5s, 3s, 5/3/1 and a deload, worked off a training max (about 90% of your 1RM). Training maxes go up after every cycle.',
    builtIn: true,
    createdAt: 7,
    days: [
      day('531-ohp', 'Press day', [
        scheme(OHP, '531', 3, 5),
        accessory('Wide-Grip_Lat_Pulldown', 5, 8, 12),
        accessory('Dips_-_Triceps_Version', 3, 8, 15),
      ]),
      day('531-dl', 'Deadlift day', [
        scheme(DEADLIFT, '531', 3, 5),
        accessory('Lying_Leg_Curls', 3, 10, 15),
        accessory('Hanging_Leg_Raise', 3, 8, 15),
      ]),
      day('531-bench', 'Bench day', [
        scheme(BENCH, '531', 3, 5),
        accessory('One-Arm_Dumbbell_Row', 5, 8, 12),
        accessory('Face_Pull', 3, 12, 20),
      ]),
      day('531-squat', 'Squat day', [
        scheme(SQUAT, '531', 3, 5),
        accessory('Leg_Press', 3, 10, 15),
        accessory('Standing_Calf_Raises', 3, 10, 15),
      ]),
    ],
  },
];
