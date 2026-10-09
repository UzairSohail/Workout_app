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
}

export interface LoggedExercise {
  exerciseId: string;
  repMin: number;
  repMax: number;
  rest: number;
  sets: LoggedSet[];
  note?: string;
  scheme?: SchemeKind;
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
