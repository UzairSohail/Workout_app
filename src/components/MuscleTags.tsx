import { cap } from '../exercises';
import type { Exercise } from '../types';
import { subAreaLabels } from '../logic/subAreas';

/** Main muscles as solid tags, helpers as outlined ones, so it's clear at a glance what an exercise trains. */
export function MuscleTags({ exercise, compact = false }: { exercise: Exercise | undefined; compact?: boolean }) {
  if (!exercise?.primaryMuscles.length) return null;
  const secondary = compact ? [] : exercise.secondaryMuscles;
  // Which part of the muscle: upper chest, biceps long head and so on.
  const focus = compact ? [] : subAreaLabels(exercise);
  return (
    <>
    <span className={`muscle-tags ${compact ? 'compact' : ''}`}>
      {!compact && <span className="muscle-label">Targets</span>}
      {exercise.primaryMuscles.map((m) => <span key={m} className="tag primary">{cap(m)}</span>)}
      {secondary.length > 0 && (
        <>
          <span className="muscle-label">Also</span>
          {secondary.map((m) => <span key={m} className="tag">{cap(m)}</span>)}
        </>
      )}
    </span>
    {focus.length > 0 && <small className="muscle-focus">🎯 {focus.join(' · ')}</small>}
    </>
  );
}
