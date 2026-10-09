import { describe, expect, it } from 'vitest';
import { generatorEquipment, hasGear } from './equipment';
import { generateProgram } from './generator';
import { filterExercises } from '../components/ExercisePicker';
import type { Exercise } from '../types';

const ex = (id: string, equipment: string, extra: Partial<Exercise> = {}) =>
  ({ id, name: id, category: 'strength', equipment, primaryMuscles: ['chest'], secondaryMuscles: [], instructions: [], images: [], ...extra }) as Exercise;

describe('hasGear', () => {
  it('allows everything when nothing is missing', () => {
    expect(hasGear(ex('a', 'cable'), undefined)).toBe(true);
    expect(hasGear(ex('a', 'cable'), [])).toBe(true);
  });
  it('drops exercises that need missing equipment, but never custom ones', () => {
    expect(hasGear(ex('a', 'cable'), ['cable'])).toBe(false);
    expect(hasGear(ex('a', 'body only'), ['cable'])).toBe(true);
    expect(hasGear(ex('a', 'cable', { custom: true }), ['cable'])).toBe(true);
  });
  it('filters the exercise list', () => {
    const all = [ex('Cable Fly', 'cable'), ex('Dumbbell Fly', 'dumbbell')];
    expect(filterExercises(all, 'fly', '', '', true, ['cable']).map((e) => e.id)).toEqual(['Dumbbell Fly']);
    expect(filterExercises(all, 'fly', '', '', true).length).toBe(2);
  });
});

describe('generator with missing equipment', () => {
  it('picks the next option for each movement', () => {
    const noCable = (id: string) => !/Cable|Pushdown|Face_Pull|Crossover|Pulldown/.test(id);
    const p = generateProgram({ goal: 'muscle', days: 4, experience: 'intermediate', equipment: 'gym', minutes: 90 }, 'x', 0, noCable);
    const ids = p.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
    expect(ids.some((id) => !noCable(id))).toBe(false);
    expect(ids).toContain('Bent_Over_Barbell_Row');
    expect(p.days.every((d) => d.exercises.length >= 5)).toBe(true);
  });
  it('suggests the matching quiz answer', () => {
    expect(generatorEquipment(['cable'])).toBe('gym');
    expect(generatorEquipment(['barbell', 'cable', 'machine'])).toBe('dumbbells');
    expect(generatorEquipment(['barbell', 'cable', 'machine', 'dumbbell'])).toBe('bodyweight');
  });
});
