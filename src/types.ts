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

export interface PlannedExercise {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  rest: number;
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
}

export interface LoggedExercise {
  exerciseId: string;
  repMin: number;
  repMax: number;
  rest: number;
  sets: LoggedSet[];
  note?: string;
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
