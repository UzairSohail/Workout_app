import { describe, expect, it } from 'vitest';
import type { Exercise, LoggedSet, Settings, Workout } from '../types';
import { DEFAULT_SETTINGS } from '../db';
import { setsPerMuscle, weekStart, weeklySummary, weekStreak } from './progress';
import { defaultMode, newLoggedExercise, withWarmups } from './session';
import { plateText } from './plates';
import { workoutVolume } from './stats';

const DAY = 864e5;
const done = (weight: number | null, reps: number, type: LoggedSet['type'] = 'working'): LoggedSet => ({ weight, reps, type, done: true });
const wk = (t: number, exerciseId: string, sets: LoggedSet[], mode?: 'time'): Workout => ({
  id: String(t) + exerciseId, name: 'w', startedAt: t, finishedAt: t + 1,
  exercises: [{ exerciseId, repMin: 8, repMax: 12, rest: 90, sets, mode }],
});
const ex = (id: string, extra: Partial<Exercise> = {}): Exercise => ({
  id, name: id, category: 'strength', equipment: 'barbell', primaryMuscles: ['chest'], secondaryMuscles: [], instructions: [], images: [], mechanic: 'compound', ...extra,
} as Exercise);

// A Wednesday at noon, local time.
const NOW = new Date(2026, 9, 7, 12).getTime();

describe('weekStart', () => {
  it('is local midnight on Monday', () => {
    const d = new Date(weekStart(NOW));
    expect(d.getDay()).toBe(1);
    expect(d.getHours()).toBe(0);
    expect(d.getDate()).toBe(5);
  });
  it('treats Sunday as the end of the week', () => {
    expect(weekStart(new Date(2026, 9, 11, 20).getTime())).toBe(weekStart(NOW));
  });
});

describe('weeklySummary', () => {
  const workouts = [
    wk(NOW, 'bench', [done(100, 5), done(100, 5), done(40, 5, 'warmup')]),
    wk(NOW - DAY, 'bench', [done(50, 10)]),
    wk(NOW - 14 * DAY, 'bench', [done(60, 10)]),
    wk(NOW - 100 * DAY, 'bench', [done(60, 10)]),
  ];
  const weeks = weeklySummary(workouts, 4, NOW);
  it('returns the requested weeks, oldest first, empty ones included', () => {
    expect(weeks.map((w) => w.workouts)).toEqual([0, 1, 0, 2]);
  });
  it('sums working-set volume and sets only', () => {
    expect(weeks[3].volume).toBe(1500);
    expect(weeks[3].sets).toBe(3);
  });
  it('counts a streak back from last week when this week is empty', () => {
    expect(weekStreak(weeks)).toBe(1);
    expect(weekStreak([...weeks.slice(1), { start: 0, workouts: 0, volume: 0, sets: 0 }])).toBe(1);
    expect(weekStreak(weeklySummary([wk(NOW, 'a', [done(1, 1)]), wk(NOW - 7 * DAY, 'a', [done(1, 1)])], 4, NOW))).toBe(2);
  });
});

describe('setsPerMuscle', () => {
  it('counts working sets by primary muscle since a date', () => {
    const byId = new Map([['bench', ex('bench')], ['squat', ex('squat', { primaryMuscles: ['quadriceps'] })]]);
    const rows = setsPerMuscle([
      wk(NOW, 'bench', [done(100, 5), done(100, 5), done(20, 10, 'warmup')]),
      wk(NOW, 'squat', [done(100, 5)]),
      wk(NOW - 30 * DAY, 'squat', [done(100, 5), done(100, 5), done(100, 5)]),
    ], byId, NOW - 7 * DAY);
    expect(rows).toEqual([['chest', 2], ['quadriceps', 1]]);
  });
});

describe('timed sets', () => {
  const settings: Settings = { ...DEFAULT_SETTINGS };
  it('defaults holds, cardio and stretches to time', () => {
    expect(defaultMode(ex('Plank', { equipment: 'body only' }))).toBe('time');
    expect(defaultMode(ex('Jogging', { category: 'cardio' }))).toBe('time');
    expect(defaultMode(ex('Bench Press'))).toBe('reps');
    expect(defaultMode(ex('Plank'), 'reps')).toBe('reps');
  });
  it('uses a seconds range and skips warm-ups', () => {
    const le = newLoggedExercise('Plank', 3, 8, 12, 60, [], new Map(), settings, 'time');
    expect(le).toMatchObject({ mode: 'time', repMin: 30, repMax: 60 });
    expect(le.sets).toHaveLength(3);
    const loaded = { ...le, sets: le.sets.map((s) => ({ ...s, weight: 100 })) };
    expect(withWarmups(loaded, ex('Plank'), true, settings)).toBe(loaded);
  });
  it('leaves timed sets out of volume', () => {
    expect(workoutVolume(wk(NOW, 'Plank', [done(10, 60)], 'time'))).toBe(0);
  });
});

describe('plateText', () => {
  it('lists plates per side', () => {
    expect(plateText(100, 'kg')).toBe('25 + 15 per side');
    expect(plateText(20, 'kg')).toBe('Just the bar');
    expect(plateText(225, 'lb')).toBe('45 + 45 per side');
  });
  it('flags weights the plates cannot make', () => {
    expect(plateText(61, 'kg')).toBe('20 per side (0.5 kg short per side)');
    expect(plateText(10, 'kg')).toBe('Less than the 20 kg bar');
  });
});
