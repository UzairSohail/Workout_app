import { describe, expect, it } from 'vitest';
import type { Day, Workout } from '../types';
import { fresherDay, recentLoad, recoveryNote, tiredGroups } from './recovery';

const H = 36e5;
const NOW = 1000 * H;
const day = (name: string, ...ids: string[]): Day => ({ id: name, name, exercises: ids.map((exerciseId) => ({ exerciseId, sets: 3, repMin: 8, repMax: 12, rest: 90 })) });
const w = (hoursAgo: number, ...ex: [string, number][]): Workout => ({
  id: String(hoursAgo), name: 'w', startedAt: NOW - hoursAgo * H, finishedAt: NOW - hoursAgo * H + H,
  exercises: ex.map(([exerciseId, n]) => ({ exerciseId, repMin: 8, repMax: 12, rest: 90,
    sets: [{ weight: 20, reps: 10, type: 'warmup' as const, done: true }, ...Array.from({ length: n }, () => ({ weight: 50, reps: 10, type: 'working' as const, done: true }))] })),
});
const push = day('Push', 'Barbell_Bench_Press_-_Medium_Grip', 'Dumbbell_Shoulder_Press', 'Triceps_Pushdown');
const pull = day('Pull', 'Wide-Grip_Lat_Pulldown', 'Seated_Cable_Rows', 'Barbell_Curl');
const legs = day('Legs', 'Barbell_Squat', 'Romanian_Deadlift');
const byId = new Map();

describe('recovery', () => {
  it('counts hard sets from the last 48 hours only, without warm-ups', () => {
    const load = recentLoad([w(20, ['Barbell_Bench_Press_-_Medium_Grip', 4]), w(60, ['Barbell_Bench_Press_-_Medium_Grip', 10])], byId, NOW);
    expect(load.get('chest')).toBe(4);
  });

  it('flags a push day the day after a big chest session and suggests another day', () => {
    const load = recentLoad([w(20, ['Barbell_Bench_Press_-_Medium_Grip', 4], ['Incline_Dumbbell_Press', 4])], byId, NOW);
    expect(tiredGroups(push, load, byId)).toEqual(['chest']);
    expect(fresherDay([push, pull, legs], push, load, byId)?.name).toBe('Pull');
    expect(recoveryNote(['chest'], load)).toBe('Your chest got up to 8 hard sets in the last 2 days, so it may still be recovering.');
  });

  it('is quiet when the muscles have had two days off', () => {
    const load = recentLoad([w(50, ['Barbell_Bench_Press_-_Medium_Grip', 8])], byId, NOW);
    expect(tiredGroups(push, load, byId)).toEqual([]);
  });

  it('skips days that are tired too', () => {
    const load = recentLoad([w(10, ['Barbell_Bench_Press_-_Medium_Grip', 8]), w(30, ['Wide-Grip_Lat_Pulldown', 8])], byId, NOW);
    expect(fresherDay([push, pull, legs], push, load, byId)?.name).toBe('Legs');
  });
});
