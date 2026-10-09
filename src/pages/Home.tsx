import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { backupDue, backupNow } from '../backup';
import { db, getProgramState } from '../db';
import { exerciseName, useExercises } from '../exercises';
import { fmtDate, fmtDuration } from '../format';
import { useActiveWorkout, useFinished, useSettings } from '../hooks';
import { liftKey, SCHEME_LABEL, uses531, WEEKS_531 } from '../logic/schemes';
import { startWorkout } from '../logic/session';
import type { Day, Program } from '../types';
import { CalendarIcon, DumbbellIcon, HistoryIcon, PlusIcon } from '../components/Icons';

const greeting = (h = new Date().getHours()) => (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');

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

  const state = useLiveQuery(
    () => (settings.activeProgramId ? getProgramState(settings.activeProgramId) : undefined),
    [settings.activeProgramId],
  );
  const is531 = !!program && uses531(program.days);
  const missingTm = is531 && !!state && program!.days.some((d) =>
    d.exercises.some((e) => e.scheme === '531' && state.lifts[liftKey('531', e.exerciseId)]?.weight == null));

  const start = async (opts: { program?: Program; day?: Day }) => {
    await startWorkout(opts, byId);
    navigate('/workout');
  };

  const weekAgo = Date.now() - 7 * 864e5;
  const thisWeek = finished?.filter((w) => w.startedAt > weekAgo).length ?? 0;
  const weekTarget = Math.max(1, program?.days.length ?? 3);
  const next = program?.days[settings.nextDayIndex % Math.max(1, program.days.length)];

  return (
    <>
      <header className="page-head">
        <p className="greeting">{greeting()}{settings.name ? ',' : ''}</p>
        <h1>{settings.name || 'Ready to train?'}</h1>
        <p className="muted small">{new Date().toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</p>
      </header>

      <section className="card week-card">
        <div className="section-head">
          <strong>This week</strong>
          <span className="muted small">{thisWeek} / {weekTarget} workouts</span>
        </div>
        <div className="meter"><span style={{ width: `${Math.min(100, (thisWeek / weekTarget) * 100)}%` }} /></div>
      </section>

      {active && (
        <section className="card accent">
          <h2>Workout in progress</h2>
          <p className="muted">{active.name}, started {new Date(active.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
          <Link className="button wide" to="/workout">Resume</Link>
        </section>
      )}

      {!active && program && next && (
        <section className="card hero-card">
          <p className="eyebrow">{program.name}{is531 && state ? ` · week ${state.week + 1} (${WEEKS_531[state.week].name})` : ''} · next up</p>
          {missingTm && (
            <p className="notice">Set your training maxes first so the app can work out your weights. <Link to={`/programs/${program.id}`}>Set them</Link></p>
          )}
          <h2>{next.name}</h2>
          <ul className="plain">
            {next.exercises.map((e, i) => (
              <li key={i}>{exerciseName(byId, e.exerciseId)} <span className="muted">{e.scheme ? SCHEME_LABEL[e.scheme] : `${e.sets} × ${e.repMin}–${e.repMax}`}</span></li>
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
          <Link className="button wide" to="/programs/generate">✨ Build a routine for me</Link>
          <Link className="button secondary wide" to="/programs">Choose a split</Link>
        </section>
      )}

      <section>
        <h2>Quick actions</h2>
        <div className="quick">
          {!active && (
            <button onClick={() => start({})}><span className="ico"><PlusIcon /></span>Empty workout</button>
          )}
          <Link to="/exercises"><span className="ico"><DumbbellIcon /></span>Exercises</Link>
          <Link to="/programs"><span className="ico"><CalendarIcon /></span>Splits</Link>
          <Link to="/history?tab=progress"><span className="ico"><HistoryIcon /></span>Progress</Link>
        </div>
      </section>

      {!active && finished && backupDue(settings.lastBackupAt, finished.length) && (
        <section className="card">
          <h2>💾 Back up your workouts</h2>
          <p className="muted small">Your history only lives on this phone. Save a backup file (to Files, Drive or email) so a lost or reset phone doesn't wipe it.</p>
          <button className="secondary wide" onClick={() => backupNow().catch(() => {})}>Save backup</button>
        </section>
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
