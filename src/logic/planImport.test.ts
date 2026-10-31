import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { withExtras } from '../exercises';
import type { Exercise } from '../types';
import { cleanName, matchExercise, parseDetail, parsePlan } from './planImport';

const library = JSON.parse(readFileSync(new URL('../../public/exercises.json', import.meta.url), 'utf8')) as Exercise[];
const all = withExtras(library);
// Text that on-device OCR read from a real Fitbod "Pull Day" screenshot, noise and all.
const pullDay = readFileSync(new URL('./fixtures/fitbod-pull-day.txt', import.meta.url), 'utf8');
// The same screenshot read in the browser after the app's greyscale/invert step.
const pullDayBrowser = readFileSync(new URL('./fixtures/fitbod-pull-day-browser.txt', import.meta.url), 'utf8');

describe('plan screenshot import', () => {
  it('reads sets and reps in the common formats and ignores weights', () => {
    expect(parseDetail('3 Sets • 8 Reps • 55 kg')).toEqual({ sets: 3, repMin: 8, repMax: 8, mode: 'reps' });
    expect(parseDetail('<3 Sets 16 Reps «20 k')).toMatchObject({ sets: 3, repMin: 16 });
    expect(parseDetail('3setse B8repse35Ib')).toMatchObject({ sets: 3, repMin: 8 });
    expect(parseDetail('4 × 8-12')).toMatchObject({ sets: 4, repMin: 8, repMax: 12 });
    expect(parseDetail('10 x 135 lb')).toBeNull();
    expect(parseDetail('3 sets · 45 sec')).toEqual({ sets: 3, repMin: 45, repMax: 45, mode: 'time' });
    expect(parseDetail('Lat Pulldown')).toBeNull();
  });

  it('strips thumbnail noise around names', () => {
    expect(cleanName('hl 8 Machine Row i.')).toBe('Machine Row');
    expect(cleanName('nt \\ Ab Crunch Machine N')).toBe('Ab Crunch Machine');
    expect(cleanName(': £ Dumbbell Bent Over Row iN')).toBe('Dumbbell Bent Over Row');
    expect(cleanName('I\'s "™ Lat Pulldown “ee')).toBe('Lat Pulldown');
    expect(cleanName('Landmine Squat to Press')).toBe('Landmine Squat to Press');
    expect(cleanName('| ;')).toBeNull();
  });

  it('reads a real Fitbod screenshot into the same exercises, sets, reps and supersets', () => {
    const plan = parsePlan(pullDay);
    expect(plan.title).toBe('Pull Day');
    expect(plan.rows.map((r) => [r.name, r.sets, r.repMin])).toEqual([
      ['Lat Pulldown', 3, 8],
      ['Hammer Curls', 3, 10],
      ['Dumbbell Bent Over Row', 3, 10],
      ['Preacher Curl', 3, 16],
      ['Dumbbell Row', 3, 8],
      ['Machine Row', 3, 10],
      // An icon fragment survives here; matching drops it (see below).
      ['Fl Seated Dumbbell Curl', 3, 12],
      ['Ab Crunch Machine', 3, 10],
      ['Decline Crunch', 3, 15],
    ]);
    expect(plan.rows.filter((r) => r.supersetWithNext).map((r) => r.name)).toEqual(['Hammer Curls', 'Preacher Curl', 'Machine Row']);
  });

  it('finds the same plan in the browser reading', () => {
    const plan = parsePlan(pullDayBrowser);
    expect(plan.title).toBe('Pull Day');
    expect(plan.rows.map((r) => matchExercise(all, r.name)?.name)).toEqual([
      'Wide-Grip Lat Pulldown', 'Hammer Curls', 'Bent Over Two-Dumbbell Row', 'Preacher Curl', 'One-Arm Dumbbell Row',
      'Machine Seated Row', 'Seated Dumbbell Curl', 'Machine Ab Crunch', 'Decline Crunch',
    ]);
    expect(plan.rows.map((r) => [r.sets, r.repMin])).toEqual([[3, 8], [3, 10], [3, 10], [3, 16], [3, 8], [3, 10], [3, 12], [3, 10], [3, 15]]);
    expect(plan.rows.filter((r) => r.supersetWithNext).length).toBe(3);
  });

  it('matches every Fitbod name to a catalog exercise', () => {
    const names = parsePlan(pullDay).rows.map((r) => matchExercise(all, r.name)?.name);
    expect(names.every(Boolean)).toBe(true);
    expect(matchExercise(all, 'Fl Seated Dumbbell Curl')?.name).toBe('Seated Dumbbell Curl');
    expect(matchExercise(all, 'Hammer Curls')?.name).toBe('Hammer Curls');
  });

  it('treats machine, plate-loaded and pin-loaded names as the same movement', () => {
    const m = (q: string) => matchExercise(all, q)?.name;
    expect(m('Machine Fly')).toBe('Machine Chest Fly (Pec Deck)');
    expect(m('Plate Loaded Fly')).toBe('Machine Chest Fly (Pec Deck)');
    expect(m('Plate Loaded Chest Press')).toBe('Chest Press (Plate-Loaded)');
    expect(m('Machine Lat Pulldown')).toBe('Lat Pulldown (Plate-Loaded)');
    const calf = matchExercise(all, 'Machine Calf Raise');
    expect(calf?.name).toMatch(/Calf Raise/);
    expect(calf?.equipment).toBe('machine');
    expect(m('Machine Shrug')).toBe('Shrug (Plate-Loaded)');
    expect(m('Chest Supported Row Machine')).toBe('Machine Chest-Supported Row');
  });

  it('prefers plain versions and exercises from the history', () => {
    const m = (q: string) => matchExercise(all, q)?.name;
    expect(m('Lat Pulldown')).toBe('Wide-Grip Lat Pulldown');
    expect(m('Hip Thrust')).toBe('Barbell Hip Thrust');
    expect(m('Cable Fly')).toBe('Cable Crossover');
    // Two equally good fits: the one already in the history wins.
    const ex = (id: string, name: string): Exercise => ({ id, name, category: 'strength', equipment: 'cable', primaryMuscles: ['lats'], secondaryMuscles: [], instructions: [], images: [] });
    const two = [ex('a', 'Wide Grip Pulldown'), ex('b', 'Close Grip Pulldown')];
    expect(matchExercise(two, 'Pulldown')?.id).toBe('a');
    expect(matchExercise(two, 'Pulldown', new Set(['b']))?.id).toBe('b');
  });

  it('counts one set per line when the plan lists each set', () => {
    const plan = parsePlan('Barbell Squat\n10 reps × 100 kg\n10 reps × 100 kg\n8 reps × 100 kg\nLeg Extension\n3 sets • 12 reps');
    expect(plan.rows.map((r) => [r.name, r.sets])).toEqual([['Barbell Squat', 3], ['Leg Extension', 3]]);
  });
});
