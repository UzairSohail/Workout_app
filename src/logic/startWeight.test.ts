import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../db';
import type { Exercise, Settings } from '../types';
import { suggest } from './progression';
import { bodyweightRatio, startingWeight } from './startWeight';

const ex = (name: string, equipment: string, muscle: string, mechanic = 'compound') =>
  ({ id: name, name, category: 'strength', equipment, mechanic, primaryMuscles: [muscle], secondaryMuscles: [], instructions: [], images: [] }) as Exercise;
const bench = ex('Barbell Bench Press - Medium Grip', 'barbell', 'chest');
const squat = ex('Barbell Squat', 'barbell', 'quadriceps');
const dbCurl = ex('Dumbbell Bicep Curl', 'dumbbell', 'biceps', 'isolation');
const me = (p: Partial<Settings>): Settings => ({ ...DEFAULT_SETTINGS, bodyWeight: 80, sex: 'male', ...p });

describe('startingWeight', () => {
  it('needs a body weight and a loaded exercise', () => {
    expect(startingWeight(bench, { ...DEFAULT_SETTINGS })).toBeNull();
    expect(startingWeight(ex('Pushups', 'body only', 'chest'), me({}))).toBeNull();
    expect(bodyweightRatio(ex('Stretch', 'other', 'chest'))).toBeNull();
  });
  it('scales by body weight and rounds down to loadable weights', () => {
    expect(startingWeight(bench, me({}))).toBe(35); // 80 × 0.45 = 36 → 35
    expect(startingWeight(squat, me({}))).toBe(47.5); // 80 × 0.6 = 48 → 47.5
    expect(startingWeight(dbCurl, me({}))).toBe(4); // 80 × 0.07 = 5.6 → 4 (2 kg steps)
  });
  it('is lighter for women and heavier with experience', () => {
    expect(startingWeight(bench, me({ sex: 'female', bodyWeight: 60 }))).toBe(20); // never below the bar
    expect(startingWeight(squat, me({ sex: 'female', bodyWeight: 60 }))).toBe(25);
    expect(startingWeight(bench, me({ experience: 'intermediate' }))).toBe(47.5);
  });
  it('ignores body weight beyond a BMI of 27 when height is known', () => {
    expect(startingWeight(bench, me({ bodyWeight: 120, height: 175 }))).toBe(startingWeight(bench, me({ bodyWeight: 27 * 1.75 ** 2 })));
  });
  it('works in pounds', () => {
    expect(startingWeight(bench, me({ units: 'lb' }))).toBeCloseTo(75 / 2.20462, 2); // 79 lb → 75
  });
});

describe('suggest with a starting estimate', () => {
  it('pre-fills the estimate the first time', () => {
    const s = suggest([], 8, 12, 2.5, 'kg', 35);
    expect(s).toMatchObject({ kind: 'new', weight: 35 });
    expect(s.message).toContain('35 kg');
  });
});
