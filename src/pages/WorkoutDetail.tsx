import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { db } from '../db';
import { exerciseName, useExercises } from '../exercises';
import { fmtDate, fmtDateLong, fmtDuration, fmtSecs } from '../format';
import { useFinished, useSettings } from '../hooks';
import { workoutCalories } from '../logic/calories';
import { startWorkout } from '../logic/session';
import { workoutPrs } from '../logic/records';
import { recordsFor, sessionPrs, workoutVolume, type PrKind } from '../logic/stats';
import { compareWorkouts, previousLike, workingSets, type Change } from '../logic/summary';
import { ChevronLeft, TrophyIcon } from '../components/Icons';
import { fmt, fmtWeight, toDisplay } from '../logic/units';

export function WorkoutDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const settings = useSettings();
  const { units } = settings;
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

  const summary = useMemo(() => {
    if (!w || !finished) return null;
    const prs = workoutPrs(w, finished);
    const prev = previousLike(w, finished);
    const cmp = prev ? compareWorkouts(w, prev) : null;
    const kcal = workoutCalories(w, byId, settings, finished.filter((x) => x.id !== w.id));
    const prevKcal = prev ? workoutCalories(prev, byId, settings, finished.filter((x) => x.startedAt < prev.startedAt)) : 0;
    return { prs, cmp, kcal, prevKcal };
  }, [w, finished, byId, settings]);

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
      <button className="ghost back" onClick={() => navigate('/history')}><ChevronLeft />History</button>
      <header className="done-head">
        <p className="eyebrow">{fmtDateLong(w.startedAt)}</p>
        <div className="row" style={{ gap: 12 }}>
          <h1>{w.name}</h1>
          {prCount > 0 && <span className="badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent-2)' }}>{prCount} PR{prCount === 1 ? '' : 's'}</span>}
        </div>
      </header>

      {justDone && (
        <section className="card accent">
          <h2>{prCount > 0 ? `Workout done, with ${prCount} PR${prCount === 1 ? '' : 's'}` : 'Workout done'}</h2>
          {summary?.cmp && <p>{verdict(summary.cmp.volume)}</p>}
          <p className="muted small">Your next session will suggest weights based on today.</p>
        </section>
      )}

      <div className="stats two">
        <div><strong>{w.finishedAt ? fmtDuration(w.finishedAt - w.startedAt) : '–'}</strong><small>Duration</small></div>
        <div><strong>{fmtWeight(workoutVolume(w), units)}</strong><small>Volume</small></div>
        <div><strong>{workingSets(w)}</strong><small>Working sets</small></div>
        <div><strong>{summary?.kcal ?? '–'}</strong><small>kcal (est.)</small></div>
      </div>

      {summary && summary.prs.length > 0 && (
        <section className="pr-banner">
          <span className="lead-ico"><TrophyIcon /></span>
          <div className="grow">
            <span className="small" style={{ color: 'var(--accent-2)', fontWeight: 600 }}>New personal record{summary.prs.length === 1 ? '' : 's'}</span>
            <ul>
              {summary.prs.map((p) => (
                <li key={p.exerciseId}>
                  <strong>{exerciseName(byId, p.exerciseId)}</strong> · <span className="mono">{p.timed ? fmtSecs(p.reps) : p.weight ? `${fmt(toDisplay(p.weight, units))} ${units} × ${p.reps}` : `${p.reps} reps`}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {summary?.cmp && (
        <section className="card">
          <h2>Compared with last time</h2>
          <p className="muted small">{summary.cmp.prev.name}, {fmtDate(summary.cmp.prev.startedAt)}</p>
          <ul className="plain compare">
            <CompareRow label="Volume" c={summary.cmp.volume} show={(v) => fmtWeight(v, units)} />
            <CompareRow label="Working sets" c={summary.cmp.sets} show={String} />
            <CompareRow label="Duration" c={summary.cmp.duration} show={(v) => fmtDuration(v)} neutral />
            <CompareRow label="Calories" c={{ now: summary.kcal, before: summary.prevKcal, diff: summary.kcal - summary.prevKcal, pct: null }} show={(v) => `${v} kcal`} />
          </ul>
        </section>
      )}

      <section>
        <h2 className="section-label" style={{ marginBottom: 4 }}>Exercises</h2>
        {w.exercises.map((e, i) => (
          <div key={i} style={{ padding: '12px 2px', borderTop: i ? '1px solid var(--line)' : undefined }}>
            <Link to={`/exercises/${e.exerciseId}`} style={{ color: 'var(--text)', fontWeight: 500 }}>{exerciseName(byId, e.exerciseId)}</Link>
            <div className="set-chips">
              {e.sets.map((s, si) => {
                const prs = prsByExercise.get(i)?.[si] ?? [];
                const what = `${s.weight ? `${fmt(toDisplay(s.weight, units))}×` : ''}${e.mode === 'time' ? fmtSecs(s.reps ?? 0) : s.reps}`;
                return (
                  <span key={si} className={prs.length ? 'pr' : s.type === 'warmup' ? 'warm' : ''}
                    title={s.type === 'warmup' ? 'Warm-up' : s.type === 'drop' ? 'Drop set' : prs.length ? 'Personal record' : undefined}>
                    {s.type === 'warmup' ? 'W ' : s.type === 'drop' ? 'D ' : ''}{what}{!s.weight && e.mode !== 'time' ? ' reps' : ''}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </section>
      {w.notes && <section className="card"><p>{w.notes}</p></section>}

      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <button className="wide grow" onClick={repeat}>Repeat workout</button>
        <Link className="button secondary" style={{ minHeight: 54, borderRadius: 18, padding: '0 22px' }} to={`/history/${w.id}/edit`}>Edit</Link>
      </div>
      <button className="ghost danger wide" onClick={remove}>Delete workout</button>
    </>
  );
}

function verdict(volume: Change): string {
  if (volume.pct == null) return 'First time logging weights for this one.';
  if (volume.pct >= 3) return `You moved ${volume.pct}% more weight than last time. Nice work!`;
  if (volume.pct <= -10) return `About ${-volume.pct}% less volume than last time. Rest up and go again.`;
  return 'About the same volume as last time. Consistency counts.';
}

function CompareRow({ label, c, show, neutral = false }: { label: string; c: Change; show: (v: number) => string; neutral?: boolean }) {
  const up = c.diff > 0;
  const same = Math.abs(c.diff) < 1e-9 || (neutral && Math.abs(c.diff) < 60000);
  const sign = same ? '' : up ? '+' : '−';
  const tone = same || neutral ? '' : up ? 'up' : 'down';
  return (
    <li className="section-head">
      <span>{label}</span>
      <span>
        <strong>{show(c.now)}</strong>{' '}
        <small className={`delta ${tone}`}>{same ? 'same' : `${sign}${show(Math.abs(c.diff))}${c.pct != null ? ` (${up ? '+' : ''}${c.pct}%)` : ''}`}</small>
      </span>
    </li>
  );
}
