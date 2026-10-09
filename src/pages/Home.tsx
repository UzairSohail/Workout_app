import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../db';
import { exerciseName, useExercises } from '../exercises';
import { fmtDate, fmtDuration } from '../format';
import { useActiveWorkout, useFinished, useSettings } from '../hooks';
import { startWorkout } from '../logic/session';
import type { Day, Program } from '../types';

export function Home() {
  const settings = useSettings();
  const finished = useFinished();
  const active = useActiveWorkout();
  const { byId } = useExercises();
  const navigate = useNavigate();
  const program = useLiveQuery(
    () => (settings.activeProgramId ? db.programs.get(settings.activeProgramId) : undefined),
    [settings.activeProgramId],
  );

  const start = async (opts: { program?: Program; day?: Day }) => {
    await startWorkout(opts, byId);
    navigate('/workout');
  };

  const weekAgo = Date.now() - 7 * 864e5;
  const thisWeek = finished?.filter((w) => w.startedAt > weekAgo).length ?? 0;
  const next = program?.days[settings.nextDayIndex % Math.max(1, program.days.length)];

  return (
    <>
      <header className="page-head">
        <h1>{settings.name ? `Hey ${settings.name}` : 'Today'}</h1>
        <p className="muted">{thisWeek} workout{thisWeek === 1 ? '' : 's'} in the last 7 days</p>
      </header>

      {active && (
        <section className="card accent">
          <h2>Workout in progress</h2>
          <p className="muted">{active.name}, started {new Date(active.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
          <Link className="button wide" to="/workout">Resume</Link>
        </section>
      )}

      {!active && program && next && (
        <section className="card">
          <p className="eyebrow">{program.name} · next up</p>
          <h2>{next.name}</h2>
          <ul className="plain">
            {next.exercises.map((e, i) => (
              <li key={i}>{exerciseName(byId, e.exerciseId)} <span className="muted">{e.sets} × {e.repMin}–{e.repMax}</span></li>
            ))}
          </ul>
          <button className="wide" onClick={() => start({ program, day: next })}>Start {next.name}</button>
          {program.days.length > 1 && (
            <div className="chips">
              {program.days.filter((d) => d.id !== next.id).map((d) => (
                <button key={d.id} className="chip" onClick={() => start({ program, day: d })}>{d.name}</button>
              ))}
            </div>
          )}
        </section>
      )}

      {!active && !program && (
        <section className="card">
          <h2>Pick a split</h2>
          <p className="muted">Choose a built-in program or build your own, and the app will line up each day for you.</p>
          <Link className="button wide" to="/programs">Choose a split</Link>
        </section>
      )}

      {!active && (
        <button className="secondary wide" onClick={() => start({})}>Start an empty workout</button>
      )}

      <section>
        <div className="section-head">
          <h2>Recent</h2>
          <Link to="/history">See all</Link>
        </div>
        {finished?.length === 0 && <p className="muted">No workouts yet. Your history will show up here.</p>}
        <ul className="list">
          {finished?.slice(0, 3).map((w) => (
            <li key={w.id}>
              <Link className="list-item" to={`/history/${w.id}`}>
                <span>
                  <strong>{w.name}</strong>
                  <small className="muted">{fmtDate(w.startedAt)} · {fmtDuration(w.finishedAt! - w.startedAt)} · {w.exercises.length} exercises</small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
