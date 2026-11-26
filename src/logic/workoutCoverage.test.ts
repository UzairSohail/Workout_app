import { describe, expect, it } from 'vitest';
import type { Exercise } from '../types';
import { exerciseParts, workoutCoverage } from './workoutCoverage';

const ex = (id: string, name: string, primaryMuscles: string[]): Exercise =>
  ({ id, name, primaryMuscles, secondaryMuscles: [] } as unknown as Exercise);

const push = [
  ex('Barbell_Bench_Press_-_Medium_Grip', 'Barbell Bench Press - Medium Grip', ['chest']),
  ex('Incline_Dumbbell_Press', 'Incline Dumbbell Press', ['chest']),
  ex('Dips_-_Chest_Version', 'Dips - Chest Version', ['chest']),
  ex('Seated_Barbell_Military_Press', 'Seated Barbell Military Press', ['shoulders']),
  ex('Side_Lateral_Raise', 'Side Lateral Raise', ['shoulders']),
  ex('Triceps_Pushdown_-_Rope_Attachment', 'Triceps Pushdown - Rope Attachment', ['triceps']),
  ex('Triceps_Overhead_Extension_with_Rope', 'Cable Rope Overhead Triceps Extension', ['triceps']),
];

describe('workoutCoverage', () => {
  it('lists the parts a push day covers and what it skips', () => {
    const { covered, skipped } = workoutCoverage(push);
    expect(covered.map((c) => c.label)).toEqual(['Chest', 'Shoulders', 'Triceps']);
    expect(covered[0].parts).toEqual(['upper', 'mid', 'lower']);
    expect(covered[1].parts).toEqual(['front', 'side']);
    expect(covered[2].parts).toEqual(['long head', 'outer heads']);
    expect(skipped).toContain('Back');
    expect(skipped).toContain('Biceps');
    expect(skipped).toContain('Legs');
    expect(skipped).not.toContain('Quads');
    expect(skipped).toContain('Rear delts');
  });

  it('names missing parts of a group that is trained', () => {
    const { skipped } = workoutCoverage([push[0]]);
    expect(skipped).toContain('Upper chest');
  });

  it('shows main and helper parts for one exercise', () => {
    const { main, also } = exerciseParts(push[0]);
    expect(main).toEqual(['Mid chest']);
    expect(also).toEqual(['Lower chest', 'Front delts', 'Triceps outer heads']);
  });
});
