import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Exercise } from '../types';
import { subAreaLabels } from './subAreas';

const library: Exercise[] = JSON.parse(readFileSync(new URL('../../public/exercises.json', import.meta.url), 'utf8'));
const byId = new Map(library.map((e) => [e.id, e]));
const labels = (id: string) => subAreaLabels(byId.get(id));

describe('subAreaLabels', () => {
  it('uses the hand tags where they exist', () => {
    expect(labels('Incline_Dumbbell_Press')).toEqual(['Upper chest', 'Front delts']);
  });

  it('works out the biceps head for untagged curls', () => {
    expect(labels('EZ-Bar_Curl').sort()).toEqual(['Biceps long head', 'Biceps short head']);
    expect(labels('Close-Grip_EZ_Bar_Curl')[0]).toBe('Biceps long head');
    expect(labels('Spider_Curl')[0]).toBe('Biceps short head');
    expect(labels('Dumbbell_Prone_Incline_Curl')[0]).toBe('Biceps short head');
    expect(labels('Alternate_Hammer_Curl')[0]).toBe('Brachialis and forearm');
  });

  it('works out chest, triceps and calves from the name', () => {
    expect(labels('Decline_Dumbbell_Flyes')).toEqual(['Lower chest']);
    expect(labels('Cable_Rope_Overhead_Triceps_Extension')[0]).toBe('Triceps long head');
    expect(labels('Barbell_Seated_Calf_Raise')[0]).toBe('Calves (soleus)');
  });

  it('gives something for every strength exercise with a main muscle', () => {
    const missing = library.filter((e) => e.category === 'strength' && e.primaryMuscles.some((m) => m !== 'forearms' && m !== 'neck' && m !== 'adductors') && !subAreaLabels(e).length);
    expect(missing.map((e) => e.id)).toEqual([]);
  });
});
