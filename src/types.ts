export type Units = 'kg' | 'lb';
export type SetType = 'warmup' | 'working' | 'drop';

export interface Exercise {
  id: string;
  name: string;
  category: string;
  equipment: string;
  level?: string;
  force?: string;
  mechanic?: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
  videoUrl?: string;
  custom?: boolean;
  /** Other names people use for it, matched by search. */
  aliases?: string[];
  /** Set when the photos show a similar library movement rather than this exact one. */
  similarTo?: string;
}

export interface Settings {
  id: 'me';
  name: string;
  units: Units;
  /** Weight added when progressing, in the user's display units. */
  upperIncrement: number;
  lowerIncrement: number;
  defaultRest: number;
  activeProgramId?: string;
  nextDayIndex: number;
  lastBackupAt?: number;
  /** Add ramp-up warm-up sets before heavy compound lifts. Defaults to on. */
  warmups?: boolean;
  /** Put areas the last similar workout missed first, adding an exercise if needed. Defaults to on. */
  catchUp?: boolean;
  /** Swap accessories done for about 5 weeks straight for one that trains the same area. Defaults to on. */
  rotate?: boolean;
  /** How big a split's workouts are: as planned (default), a set number of exercises, or a length in minutes. */
  sessionSize?: 'plan' | 'exercises' | 'minutes';
  sessionExercises?: number;
  sessionMinutes?: number;
  /** End every workout with 2 ab exercises and 1 lower back exercise. */
  coreFinisher?: boolean;
  /** Deload week runs until this time. */
  deloadUntil?: number;
  /** When the last deload week started; training weeks are counted from here. */
  lastDeloadAt?: number;
  /** "Not now" on the deload suggestion; asks again two weeks later. */
  deloadSnoozedAt?: number;
  /** Library equipment types the user's gym doesn't have; hidden from pickers and the generator. */
  missingEquipment?: string[];
  /** Profile used to suggest starting weights. Body weight in kg (latest), height in cm. */
  bodyWeight?: number;
  height?: number;
  sex?: 'male' | 'female';
  /** Year of birth, for the age in the calorie estimate. */
  birthYear?: number;
  experience?: 'beginner' | 'intermediate' | 'advanced';
  /** Weigh-in reminder: 7 = every day (default), 0 = Sunday … 6 = Saturday once a week, -1 = off. */
  weighInDay?: number;
  /** When the user last tapped "Skip this week" on the reminder. */
  weighInSkippedAt?: number;
  /** End-of-rest alert. Sound and vibration default on, background notification off. */
  restSound?: boolean;
  restVibrate?: boolean;
  restNotify?: boolean;
  /** Colour theme id from src/theme.ts. Missing means the default, Ink & Pink. */
  theme?: string;
}

/**
 * How an exercise progresses. Absent = double progression within repMin–repMax.
 *  - linear: fixed sets × reps, add weight after every successful session, deload after 3 misses
 *  - 531: Wendler 5/3/1 percentages of a training max, 4-week cycle
 *  - gzcl-t1/t2/t3: GZCLP tiers with stage changes on failure
 */
export type SchemeKind = 'linear' | '531' | 'gzcl-t1' | 'gzcl-t2' | 'gzcl-t3';

export interface PlannedExercise {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  rest: number;
  scheme?: SchemeKind;
  /** 'time' = sets are held for seconds (repMin/repMax are seconds). Absent = the exercise's usual way. */
  mode?: LogMode;
}

export interface LiftState {
  /** Working weight in kg (training max for 5/3/1). */
  weight: number | null;
  /** GZCLP stage index. */
  stage: number;
  /** Consecutive failed sessions (linear). */
  fails: number;
}

export interface ProgramState {
  programId: string;
  /** 5/3/1 week within the cycle, 0–3. */
  week: number;
  /** Days finished in the current week. */
  doneDays: string[];
  /** Keyed by liftKey(scheme, exerciseId). */
  lifts: Record<string, LiftState>;
}

export interface Day {
  id: string;
  name: string;
  exercises: PlannedExercise[];
}

export interface Program {
  id: string;
  name: string;
  description?: string;
  days: Day[];
  builtIn?: boolean;
  createdAt: number;
}

export interface LoggedSet {
  /** Always stored in kg. null = not entered yet. */
  weight: number | null;
  reps: number | null;
  type: SetType;
  done: boolean;
  /** Prescribed reps for program schemes. */
  target?: number;
  /** As many reps as possible (target is the minimum). */
  amrap?: boolean;
  /** When the set was ticked off (ms), for the calorie estimate. */
  doneAt?: number;
}

export interface LoggedExercise {
  exerciseId: string;
  repMin: number;
  repMax: number;
  rest: number;
  sets: LoggedSet[];
  note?: string;
  /** Why this exercise was moved up or added: it trains an area the last similar workout missed. */
  focus?: string;
  /** Part of a deload week: fewer, lighter sets, so the usual progression advice doesn't apply. */
  deload?: boolean;
  scheme?: SchemeKind;
  /** 'time' logs seconds in the reps field. */
  mode?: LogMode;
  /** Done back to back with the next exercise; rest only after the last one. */
  supersetWithNext?: boolean;
  /** One tap after the last set: tunes the next weight suggestion. */
  feel?: Feel;
}

export type LogMode = 'reps' | 'time';
export type Feel = 'easy' | 'ok' | 'hard';

export interface BodyWeight {
  id: string;
  date: number;
  /** kg */
  weight: number;
}

/** Per-exercise preferences that stick across workouts. */
/** A photo the user took for an exercise; stays on this phone. */
export interface ExercisePhoto {
  exerciseId: string;
  photo: Blob;
  updatedAt: number;
}

export interface ExerciseNote {
  exerciseId: string;
  note: string;
  mode?: LogMode;
}

export interface Workout {
  id: string;
  name: string;
  programId?: string;
  dayId?: string;
  startedAt: number;
  finishedAt?: number;
  exercises: LoggedExercise[];
  notes?: string;
}
