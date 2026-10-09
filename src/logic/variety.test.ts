import { describe, expect, it } from 'vitest';
import type { Exercise, Workout } from '../types';
import { freshAlternatives, isStale } from './variety';

const ex = (id: string, muscle: string, equipment = 'barbell', extra: Partial<Exercise> = {}) =>
  ({ id, name: id, category: 'strength', equipment, mechanic: 'compound', primaryMuscles: [muscle], secondaryMuscles: [], instructions: [], images: [], ...extra }) as Exercise;
const DAY = 864e5;
const NOW = 100 * DAY;
const w = (daysAgo: number, ...ids: string[]): Workout => ({
  id: `${daysAgo}`, name: 'w', startedAt: NOW - daysAgo * DAY, finishedAt: NOW - daysAgo * DAY + 1,
  exercises: ids.map((exerciseId) => ({ exerciseId, repMin: 8, repMax: 12, rest: 90, sets: [] })),
});

const bench = ex('Barbell_Bench_Press_-_Medium_Grip', 'chest');
const all = [
  bench,
  ex('Dumbbell_Bench_Press', 'chest', 'dumbbell'),
  ex('Incline_Dumbbell_Press', 'chest', 'dumbbell'),
  ex('Cable_Crossover', 'chest', 'cable', { mechanic: 'isolation' }),
  ex('Pushups', 'chest', 'body only'),
  ex('Obscure_Chest_Thing', 'chest', 'other', { level: 'expert' }),
  ex('Chest_Stretch', 'chest', 'body only', { category: 'stretching' }),
  ex('Barbell_Squat', 'quadriceps'),
];
const byId = new Map(all.map((e) => [e.id, e]));

describe('isStale', () => {
  it('flags a lift done in each of the last 4 sessions for its muscle', () => {
    const hist = [w(1, bench.id), w(3, 'Barbell_Squat'), w(5, bench.id), w(8, bench.id), w(10, bench.id)];
    expect(isStale(bench, hist, byId)).toBe(true);
  });
  it('is not stale with a different chest exercise in the mix, or too little history', () => {
    expect(isStale(bench, [w(1, bench.id), w(5, 'Dumbbell_Bench_Press'), w(8, bench.id), w(10, bench.id)], byId)).toBe(false);
    expect(isStale(bench, [w(1, bench.id), w(5, bench.id)], byId)).toBe(false);
  });
});

describe('freshAlternatives', () => {
  it('suggests same-muscle strength lifts with different equipment, skipping stretches and other muscles', () => {
    const picks = freshAlternatives(bench, all, [], undefined, 3, NOW).map((e) => e.id);
    expect(picks).toHaveLength(3);
    expect(picks).not.toContain('Chest_Stretch');
    expect(picks).not.toContain('Barbell_Squat');
    expect(picks).not.toContain(bench.id);
    expect(new Set(picks.map((id) => byId.get(id)!.equipment)).size).toBe(3);
    expect(picks).not.toContain('Obscure_Chest_Thing');
  });
  it('puts lifts done recently last and respects missing equipment', () => {
    const picks = freshAlternatives(bench, all, [w(2, 'Dumbbell_Bench_Press', 'Incline_Dumbbell_Press')], ['cable'], 2, NOW).map((e) => e.id);
    expect(picks[0]).toBe('Pushups');
    expect(picks).not.toContain('Cable_Crossover');
  });
});
