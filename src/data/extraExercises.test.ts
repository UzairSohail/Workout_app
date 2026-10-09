import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { filterExercises } from '../components/ExercisePicker';
import { MUSCLES, withExtras } from '../exercises';
import type { Exercise } from '../types';
import { ALIASES, EXTRA_EXERCISES } from './extraExercises';

const library = JSON.parse(readFileSync(new URL('../../public/exercises.json', import.meta.url), 'utf8')) as Exercise[];
const all = withExtras(library);

describe('extra exercises', () => {
  it('do not duplicate library names or ids', () => {
    const names = new Set(library.map((e) => e.name.toLowerCase()));
    const ids = new Set(library.map((e) => e.id));
    for (const e of EXTRA_EXERCISES) {
      expect(names.has(e.name.toLowerCase()), e.name).toBe(false);
      expect(ids.has(e.id), e.id).toBe(false);
    }
  });
  it('use known muscles and have instructions', () => {
    for (const e of EXTRA_EXERCISES) {
      for (const m of [...e.primaryMuscles, ...e.secondaryMuscles]) expect(MUSCLES, `${e.name}: ${m}`).toContain(m);
      expect(e.instructions.length).toBeGreaterThan(1);
    }
  });
  it('alias every id that exists in the library', () => {
    const ids = new Set(library.map((e) => e.id));
    for (const id of Object.keys(ALIASES)) expect(ids.has(id), id).toBe(true);
  });
  it('are found by search, including everyday names', () => {
    const find = (q: string) => filterExercises(all, q, '', '', false).map((e) => e.name);
    expect(find('bulgarian')).toContain('Bulgarian Split Squat');
    expect(find('pec deck')).toContain('Butterfly');
    expect(find('landmine row')).toContain('Landmine Row');
    expect(find('yates row').length).toBeGreaterThan(0);
    expect(find('dumbbell thruster')).toContain('Dumbbell Thruster');
    expect(find('rdl')).toContain('Romanian Deadlift');
    expect(find('pull up')).toContain('Assisted Pull-Up');
    expect(find('hip abduction')).toContain('Thigh Abductor');
  });
});
