import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { withExtras } from '../exercises';
import type { Exercise } from '../types';
import { cleanName, fitsGear, gearIn, matchExercise, parseDetail, parsePlan, settlePick } from './planImport';

const library = JSON.parse(readFileSync(new URL('../../public/exercises.json', import.meta.url), 'utf8')) as Exercise[];
const all = withExtras(library);
// Text that on-device OCR read from a real Fitbod "Pull Day" screenshot, noise and all.
const pullDay = readFileSync(new URL('./fixtures/fitbod-pull-day.txt', import.meta.url), 'utf8');
// The same screenshot read in the browser after the app's greyscale/invert step.
const pullDayBrowser = readFileSync(new URL('./fixtures/fitbod-pull-day-browser.txt', import.meta.url), 'utf8');
// OCR of a real Fitbod "push day" screenshot that has no title header, only the Coach blurb.
const pushDay = readFileSync(new URL('./fixtures/fitbod-push-day.txt', import.meta.url), 'utf8');

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

  it('copies a Fitbod push day exercise for exercise', () => {
    const plan = parsePlan(pushDay);
    expect(plan.title).toBe('Push Day');
    expect(plan.rows.map((r) => [r.name, matchExercise(all, r.name)?.name, r.sets, r.repMin])).toEqual([
      ['Barbell Bench Press', 'Barbell Bench Press - Medium Grip', 3, 10],
      ['Dumbbell Tricep Extension', 'Standing Dumbbell Triceps Extension', 3, 12],
      ['Low Cable Chest Fly', 'Low-to-High Cable Fly', 3, 10],
      ['Cable Rope Tricep Extension', 'Triceps Pushdown - Rope Attachment', 3, 10],
      ['Push Up', 'Pushups', 3, 13],
      ['Dumbbell Skullcrusher', 'Dumbbell Skull Crusher', 3, 10],
      ['Dumbbell Fly', 'Dumbbell Flyes', 3, 10],
      ['Cable Crossover Fly', 'Cable Crossover', 3, 10],
      ['Dip', 'Dips - Triceps Version', 3, 9],
      ['Hanging Leg Raise', 'Hanging Leg Raise', 3, 10],
      ['Decline Oblique Crunch', 'Decline Oblique Crunch', 4, 6],
      ['Decline Russian Twists', 'Decline Russian Twist', 5, 7],
    ]);
    expect(plan.rows.filter((r) => r.supersetWithNext).map((r) => r.name))
      .toEqual(['Dumbbell Tricep Extension', 'Cable Rope Tricep Extension', 'Dumbbell Skullcrusher', 'Dip']);
  });

  it('never names the workout after Fitbod\'s Coach label, however OCR spaces it', () => {
    for (const label of ['CoachBETA', 'Coach BETA', 'bo MM Coach BETA', 'Coach 8ETA']) {
      const plan = parsePlan(pushDay.replace('Ww LA Coach BETA', label));
      expect(plan.title).toBe('Push Day');
      const noDay = parsePlan(pushDay.replace('Your push day', 'Your session').replace('Ww LA Coach BETA', label));
      expect(noDay.title).toBeUndefined();
      expect(noDay.rows).toHaveLength(12);
    }
    expect(parsePlan(pullDay.replace('bo Coach BETA', 'CoachBETA')).title).toBe('Pull Day');
  });

  it('prefers plan aliases over exercises already in the history', () => {
    const barbell = all.find((e) => e.name === 'Standing Overhead Barbell Triceps Extension')!;
    expect(matchExercise(all, 'Dumbbell Tricep Extension', new Set([barbell.id]))?.name).toBe('Standing Dumbbell Triceps Extension');
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

  it('reads the equipment a plan name states', () => {
    expect(gearIn('Dumbbell Bench Press')).toBe('dumbbell');
    expect(gearIn('Incline DB Press')).toBe('dumbbell');
    expect(gearIn('EZ Bar Curl')).toBe('e-z curl bar');
    expect(gearIn('Smith Machine Squat')).toBe('smith');
    expect(gearIn('Kettlebell Swing')).toBe('kettlebells');
    expect(gearIn('Machine Fly')).toBe('machine');
    expect(gearIn('Lat Pulldown')).toBeUndefined();
  });

  it('keeps the equipment the plan names whenever the library has that version', () => {
    const names = [
      'Dumbbell Bench Press', 'Dumbbell Incline Bench Press', 'Dumbbell Shoulder Press', 'Dumbbell Romanian Deadlift',
      'Dumbbell Bent Over Row', 'Dumbbell Squat', 'Dumbbell Front Squat', 'Dumbbell Overhead Press', 'Dumbbell Hang Clean',
      'Dumbbell Upright Row', 'Dumbbell Shrug', 'Dumbbell Deadlift', 'Dumbbell Close Grip Bench Press', 'Dumbbell Hip Thrust',
    ];
    for (const n of names) expect([n, matchExercise(all, n)?.equipment]).toEqual([n, 'dumbbell']);
    for (const n of ['Barbell Bench Press', 'Barbell Row', 'Barbell Curl']) expect([n, matchExercise(all, n)?.equipment]).toEqual([n, 'barbell']);
    expect(matchExercise(all, 'EZ Bar Curl')?.equipment).toBe('e-z curl bar');
  });

  it('never lets Gemini swap the stated equipment when a version with it exists', () => {
    const byId = (id: string) => all.find((e) => e.id === id)!;
    const local = matchExercise(all, 'Dumbbell Incline Bench Press');
    expect(local?.equipment).toBe('dumbbell');
    const barbell = byId('Barbell_Incline_Bench_Press_-_Medium_Grip');
    // The name says dumbbell: a barbell pick gives way to the dumbbell version.
    expect(settlePick(all, 'Dumbbell Incline Bench Press', local, barbell)).toBe(local);
    // The name names no equipment but Gemini saw dumbbells in the photo: its barbell pick still gives way.
    const seen = settlePick(all, 'Incline Bench Press', byId('Barbell_Incline_Bench_Press_-_Medium_Grip'), barbell, 'dumbbell');
    expect(fitsGear(seen!, 'dumbbell')).toBe(true);
    expect(seen!.name).toMatch(/incline/i);
    // A pick with the right equipment stands, and with no equipment stated Gemini's pick stands.
    const db = byId('Hammer_Grip_Incline_DB_Bench_Press');
    expect(settlePick(all, 'Dumbbell Incline Bench Press', local, db)).toBe(db);
    expect(settlePick(all, 'Incline Bench Press', local, barbell)).toBe(barbell);
    expect(settlePick(all, 'Lat Pulldown', undefined, barbell, 'machine')).toBe(barbell);
    // No version with that equipment at all: the closest other one stands rather than nothing.
    const band = byId('Band_Good_Morning');
    expect(settlePick(all, 'Dumbbell Good Morning', band, undefined)).toBe(band);
  });
});
