import { describe, expect, it } from 'vitest';
import type { Day, Workout } from '../types';
import { applyRotations, rotationsFor } from './rotation';

const D = 864e5;
const NOW = 400 * D;
const day: Day = { id: 'push', name: 'Push', exercises: ['Barbell_Bench_Press_-_Medium_Grip', 'Incline_Dumbbell_Press', 'Triceps_Pushdown_-_Rope_Attachment', 'Side_Lateral_Raise']
  .map((exerciseId) => ({ exerciseId, sets: 3, repMin: 8, repMax: 12, rest: 90 })) };
const session = (daysAgo: number, dayId = 'push', ids = day.exercises.map((e) => e.exerciseId)): Workout => ({
  id: String(daysAgo), name: 'Push', dayId, startedAt: NOW - daysAgo * D, finishedAt: NOW - daysAgo * D + 1,
  exercises: ids.map((exerciseId) => ({ exerciseId, repMin: 8, repMax: 12, rest: 90, sets: [] })),
});
const weekly = (weeks: number) => Array.from({ length: weeks }, (_, i) => session(2 + i * 7));

describe('rotationsFor', () => {
  it('leaves everything alone for the first few weeks', () => {
    expect(rotationsFor(day, weekly(4), NOW)).toEqual([]);
  });

  it('rotates accessories after about 5 weeks, keeping the main lifts', () => {
    const r = rotationsFor(day, weekly(6), NOW);
    expect(r.map((x) => x.from)).toEqual(['Triceps_Pushdown_-_Rope_Attachment', 'Side_Lateral_Raise']);
    expect(r.find((x) => x.from === 'Side_Lateral_Raise')!.to.id).toBe('Cable_Seated_Lateral_Raise');
    expect(r.find((x) => x.from === 'Triceps_Pushdown_-_Rope_Attachment')!.to.pattern).toBe('tri-pushdown');
  });

  it('counts the run from the last time it was left out', () => {
    const sessions = [...weekly(3), session(23, 'push', ['Barbell_Bench_Press_-_Medium_Grip']), ...weekly(8).slice(4)];
    expect(rotationsFor(day, sessions, NOW)).toEqual([]);
  });

  it('only counts sessions of the same day', () => {
    expect(rotationsFor(day, weekly(6).map((w) => ({ ...w, dayId: 'other' })), NOW)).toEqual([]);
  });

  it('respects missing equipment and swaps in place', () => {
    const r = rotationsFor(day, weekly(6), NOW, (id) => !id.startsWith('Cable'));
    expect(r.find((x) => x.from === 'Side_Lateral_Raise')).toBeUndefined();
    const next = applyRotations(day, r);
    expect(next.exercises.map((e) => e.exerciseId).slice(0, 2)).toEqual(['Barbell_Bench_Press_-_Medium_Grip', 'Incline_Dumbbell_Press']);
    expect(next.exercises[2]).toMatchObject({ sets: 3, repMin: 8, repMax: 12 });
  });
});
