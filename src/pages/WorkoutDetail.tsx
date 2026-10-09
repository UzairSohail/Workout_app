import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { db } from '../db';
import { exerciseName, useExercises } from '../exercises';
import { fmtDateLong, fmtDuration, fmtSecs } from '../format';
import { useFinished, useSettings } from '../hooks';
import { workoutCalories } from '../logic/calories';
import { startWorkout } from '../logic/session';
import { recordsFor, sessionPrs, workoutVolume, type PrKind } from '../logic/stats';
import { fmt, fmtWeight, toDisplay } from '../logic/units';

export function WorkoutDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { units, bodyWeight } = useSettings();
  const { byId } = useExercises();
  const w = useLiveQuery(() => db.workouts.get(id!), [id]);
  const finished = useFinished();

  // PRs are judged against everything logged before this workout.
  const prsByExercise = useMemo(() => {
    const m = new Map<number, PrKind[][]>();
    if (!w || !finished) return m;
    const before = finished.filter((x) => x.startedAt < w.startedAt);
    w.exercises.forEach((e, i) => {
      const prevSessions = before.filter((x) => x.exercises.some((y) => y.exerciseId === e.exerciseId));
      m.set(i, sessionPrs(e.sets, recordsFor(e.exerciseId, before), prevSessions.length > 0));
    });
    return m;
  }, [w, finished]);

  if (w === undefined) return <p className="muted">Loading…</p>;
  if (!w) return <p>Workout not found. <Link to="/history">Back to history</Link></p>;

  const prCount = [...prsByExercise.values()].flat().filter((p) => p.length > 0).length;
  const justDone = params.get('done') === '1';

  const repeat = async () => {
    await startWorkout({ copyOf: w }, byId);
    navigate('/workout');
  };
  const remove = async () => {
    if (!confirm('Delete this workout from your history?')) return;
    await db.workouts.delete(w.id);
    navigate('/history', { replace: true });
  };

  return (
    <>
      <header className="page-head">
        <button className="ghost back" onClick={() => navigate('/history')}>‹ History</button>
        <h1>{w.name}</h1>
        <p className="muted">{fmtDateLong(w.startedAt)}</p>
      </header>

      {justDone && (
        <section className="card accent">
          <h2>{prCount > 0 ? `🎉 Workout done, with ${prCount} PR${prCount === 1 ? '' : 's'}!` : '💪 Workout done!'}</h2>
          <p className="muted">Your next session will suggest weights based on today.</p>
        </section>
      )}

      <div className="stats">
        <div><strong>{w.finishedAt ? fmtDuration(w.finishedAt - w.startedAt) : '–'}</strong><small>Duration</small></div>
        <div><strong>{fmtWeight(workoutVolume(w), units)}</strong><small>Volume</small></div>
        <div><strong>{w.exercises.reduce((a, e) => a + e.sets.length, 0)}</strong><small>Sets</small></div>
        <div><strong>{workoutCalories(w, byId, bodyWeight)}</strong><small>kcal (est.)</small></div>
      </div>

      {w.exercises.map((e, i) => (
        <section key={i} className="card">
          <Link to={`/exercises/${e.exerciseId}`}><strong>{exerciseName(byId, e.exerciseId)}</strong></Link>
          <ol className="plain">
            {e.sets.map((s, si) => {
              const prs = prsByExercise.get(i)?.[si] ?? [];
              return (
                <li key={si}>
                  {s.type === 'warmup' ? 'Warm-up: ' : s.type === 'drop' ? 'Drop set: ' : ''}
                  {s.weight ? `${fmt(toDisplay(s.weight, units))} ${units} × ` : ''}{e.mode === 'time' ? fmtSecs(s.reps ?? 0) : `${s.reps} reps`}
                  {prs.length > 0 && <span className="pr-badge inline">🏆 PR</span>}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {w.notes && <section className="card"><p>{w.notes}</p></section>}

      <button className="wide" onClick={repeat}>Repeat this workout</button>
      <Link className="button secondary wide" to={`/history/${w.id}/edit`}>Edit workout</Link>
      <button className="ghost danger wide" onClick={remove}>Delete workout</button>
    </>
  );
}
